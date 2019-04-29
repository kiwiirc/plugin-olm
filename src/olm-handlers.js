import { Message as IrcMessage } from 'irc-framework'
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

export function normalizeEvent(handler) {
	return function normalizingWrapper(event) {
		const {
			nick: sender,
			tags,
			command,
			params: [target, text],
		} = event
		return handler({ sender, tags, command, target, text })
	}
}

export function handleOlmPacket(olmBroker) {
	function olmPacketHandler({ sender, tags, command, target, text }) {
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
		const packetEvent = { sender, target, payload }
		client.emit('olm.packet', packetEvent)
	}

	// return fragmentationHandlingWrapper(olmBroker.client, olmPacketHandler)
	return normalizeEvent(olmPacketHandler)
}

export function handleOlmIdentityRequest(olmBroker) {
	function olmIdentityRequestHandler({ sender, tags, command, target, text }) {
		if (command !== COMMANDS.TAGMSG) return
		if (!has(tags, TAGS.OLM_IDENTITY_REQUEST)) return

		const { client } = olmBroker

		if (sender === client.user.nick) return // ignore self

		const identity = new OlmIdentity(olmBroker.getOwnCurve25519IdentityKey())

		const response = new IrcMessage(COMMANDS.TAGMSG, sender)
		response.tags[TAGS.OLM_IDENTITY] = serializeToMessageTagValue(identity)
		if (has(tags, TAGS.MSGID)) {
			response.tags[TAGS.REPLY] = tags[TAGS.MSGID]
		}
		client.raw(response.to1459()) // HACK: .to1459()
	}

	return normalizeEvent(olmIdentityRequestHandler)
}

export function handleOlmOneTimeKeyRequest(olmBroker) {
	function olmOneTimeKeyRequestHandler({ sender, tags, command }) {
		if (command !== COMMANDS.TAGMSG) return
		if (!has(tags, TAGS.OLM_ONETIMEKEY_REQUEST)) return

		const { client } = olmBroker

		const response = new IrcMessage(COMMANDS.TAGMSG, sender)

		response.tags[TAGS.OLM_ONETIMEKEY] = serializeToMessageTagValue(
			OlmOneTimeKey.generate(olmBroker.localAccount),
		)

		if (has(tags, TAGS.MSGID)) {
			response.tags[TAGS.REPLY] = tags[TAGS.MSGID]
		}

		client.raw(response.to1459()) // HACK: .to1459()
	}

	return normalizeEvent(olmOneTimeKeyRequestHandler)
}

export function handleOlmMessage(olmBroker) {
	return function olmMessageHandler({ sender, target, payload }) {
		if (!(payload instanceof OlmMessage)) return

		const { text } = payload

		olmBroker.client.emit('olm.message', { sender, target, text })
	}
}
