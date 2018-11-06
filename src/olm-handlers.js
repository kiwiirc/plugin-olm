import IRC from 'irc-framework'
import { has } from 'lodash'
import { COMMANDS, TAGS } from './constants'
import {
	serializeToMessageTagValue,
	deserializeFromMessageTagValue,
} from './serialization/message-tags'
import OlmOneTimeKey from './serialization/types/olm-onetimekey'
import OlmPacket from './serialization/types/olm-packet'
import OlmIdentity from './serialization/types/olm-identity'
import OlmMessage from './serialization/types/olm-message'

export function handleOlmPacket(olmBroker) {
	return function olmPacketHandler({ sender, tags, command, target }) {
		if (command !== COMMANDS.TAGMSG) return
		if (!has(tags, TAGS.OLM_PACKET)) return

		const { client } = olmBroker

		const packet = deserializeFromMessageTagValue(tags[TAGS.OLM_PACKET])
		if (!(packet instanceof OlmPacket)) throw new TypeError('not an OlmPacket')

		let payload
		try {
			payload = packet.decrypt(olmBroker)
		} catch (error) {
			client.emit('olm.packet.error', { sender, target, error })
			return
		}
		const event = { sender, target, payload }
		client.emit('olm.packet', event)
	}
}

export function handleOlmIdentityRequest(olmBroker) {
	return function olmIdentityRequestHandler({ sender, tags, command }) {
		if (command !== COMMANDS.TAGMSG) return
		if (!has(tags, TAGS.OLM_IDENTITY_REQUEST)) return

		const { client } = olmBroker

		const identity = new OlmIdentity(olmBroker.getOwnCurve25519IdentityKey())

		const response = new IRC.Message(COMMANDS.TAGMSG, sender)
		response.tags[TAGS.OLM_IDENTITY] = serializeToMessageTagValue(identity)
		if (has(tags, TAGS.MSGID)) {
			response.tags[TAGS.REPLY] = tags[TAGS.MSGID]
		}
		client.raw(response)
	}
}

export function handleOlmOneTimeKeyRequest(olmBroker) {
	return function olmOneTimeKeyRequestHandler({ sender, tags, command }) {
		if (command !== COMMANDS.TAGMSG) return
		if (!has(tags, TAGS.OLM_ONETIMEKEY_REQUEST)) return

		const { client } = olmBroker

		const response = new IRC.Message(COMMANDS.TAGMSG, sender)

		response.tags[TAGS.OLM_ONETIMEKEY] = serializeToMessageTagValue(
			OlmOneTimeKey.generate(olmBroker.localAccount),
		)

		if (has(tags, TAGS.MSGID)) {
			response.tags[TAGS.REPLY] = tags[TAGS.MSGID]
		}

		client.raw(response)
	}
}

export function handleOlmMessage(olmBroker) {
	return function olmMessageHandler({ sender, target, payload }) {
		if (!(payload instanceof OlmMessage)) return

		const { text } = payload

		olmBroker.client.emit('secure-message', { sender, target, text })
	}
}
