import { has, mergeWith } from 'lodash'
import { TAGS, COMMANDS } from './constants'
import MegolmSessionState from './serialization/types/megolm-session-state'
import Olm from 'olm'
import { deserializeFromMessageTagValue } from './serialization/message-tags'
import MegolmPacket from './serialization/types/megolm-packet'
import cborDecode from './serialization/cbor-decoder'
import MegolmMessage from './serialization/types/megolm-message'
import { awaitMessage, timeout } from './utils'

export function handleMegolmState(megomlContext) {
	return function megolmStateHandler({ payload /* sender, target */ }) {
		if (!(payload instanceof MegolmSessionState)) return
		const { /* messageIndex, */ sessionKeyBase64, sessionIDBase64 } = payload
		const session = new Olm.InboundGroupSession()
		session.create(sessionKeyBase64)
		megomlContext.inboundSessions.set(sessionIDBase64, session)
	}
}

function fragmentationHandlingWrapper(megolmContext, wrappedHandler) {
	return async function fragmentedPacketHandler(event) {
		const { sender, tags, command, target } = event

		let fragmented = tags[TAGS.FRAGMENTED]
		let previousFragment = tags[TAGS.PREVIOUS_FRAGMENT]

		// not fragmented, just use wrappedHandler directly
		if (!fragmented && !previousFragment) return wrappedHandler(event)

		// first fragment
		if (fragmented && !previousFragment) {
			previousFragment = event.tags[TAGS.MSGID]
			let merged = { ...event }
			while (fragmented) {
				let nextFragment
				try {
					// wait up to 15 seconds for next fragment. throws if timeout expires to avoid permanent memory use
					nextFragment = await Promise.race([
						awaitMessage(
							megolmContext.client,
							msg =>
								msg.nick === sender &&
								msg.tags[TAGS.PREVIOUS_FRAGMENT] === previousFragment,
						),
						timeout(
							15,
							new Error(
								'Timeout expired waiting for next chunk of fragmented megolm packet',
							),
						),
					])
				} catch (error) {
					megolmContext.client.emit('megolm.packet.error', { sender, target, error })
				}

				fragmented = nextFragment.tags[TAGS.FRAGMENTED]
				previousFragment = nextFragment.tags[TAGS.MSGID]

				// merge fragments
				merged = {
					...merged,
					tags: mergeWith(
						merged.tags,
						nextFragment.tags,
						(prevTagVal, newTagVal, tag) => {
							switch (tag) {
								// concatenate megolm packet data
								case TAGS.MEGOLM_PACKET:
									return `${prevTagVal}${newTagVal}`

								case TAGS.LABEL:
								case TAGS.FRAGMENTED:
								case TAGS.PREVIOUS_FRAGMENT:
								case TAGS.MSGID:
								case TAGS.TIME:
									return prevTagVal

								// some other tag we don't know what to do with
								default:
									throw new Error('Unhandled tag for merging')
							}
						},
					),
				}
			}

			return wrappedHandler(merged)
		}
	}
}

export function handleMegolmPacket(megolmContext) {
	function megolmPacketHandler({ sender, tags, command, target }) {
		if (command !== COMMANDS.TAGMSG) return
		if (!has(tags, TAGS.MEGOLM_PACKET)) return
		if (sender === megolmContext.client.user.nick) return // ignore own messages

		const { client } = megolmContext
		const packet = deserializeFromMessageTagValue(tags[TAGS.MEGOLM_PACKET])
		if (!(packet instanceof MegolmPacket)) throw new TypeError('not a MegolmPacket')

		let decryptionResult
		try {
			decryptionResult = packet.decrypt(megolmContext)
		} catch (error) {
			client.emit('megolm.packet.error', { sender, target, error })
			return
		}
		const { plaintext } = decryptionResult
		const payload = cborDecode(plaintext)
		const event = { sender, target, payload }
		client.emit('megolm.packet', event)
	}

	return fragmentationHandlingWrapper(megolmContext, megolmPacketHandler)
}

export function handleMegolmMessage(megolmContext) {
	return function megolmMessageHandler({ sender, target, payload }) {
		if (!(payload instanceof MegolmMessage)) return
		const { client } = megolmContext
		const { text } = payload
		client.emit('megolm.message', { sender, target, text })
	}
}
