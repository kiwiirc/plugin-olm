import { has } from 'lodash'
import { TAGS, COMMANDS } from './constants'
import MegolmSessionState from './serialization/types/megolm-session-state'
import Olm from 'olm'
import { deserializeFromMessageTagValue } from './serialization/message-tags'
import MegolmPacket from './serialization/types/megolm-packet'
import cborDecode from './serialization/cbor-decoder'
import MegolmMessage from './serialization/types/megolm-message'

export function handleMegolmState(megomlContext) {
	return function megolmStateHandler({ payload /* sender, target */ }) {
		if (!(payload instanceof MegolmSessionState)) return
		const { /* messageIndex, */ sessionKeyBase64, sessionIDBase64 } = payload
		const session = new Olm.InboundGroupSession()
		session.create(sessionKeyBase64)
		megomlContext.inboundSessions.set(sessionIDBase64, session)
	}
}

export function handleMegolmPacket(megolmContext) {
	return function megolmPacketHandler({ sender, tags, command, target }) {
		if (command !== COMMANDS.TAGMSG) return
		if (!has(tags, TAGS.MEGOLM_PACKET)) return

		const { client } = megolmContext
		const packet = deserializeFromMessageTagValue(tags[TAGS.MEGOLM_PACKET])
		if (!(packet instanceof MegolmPacket)) throw new TypeError('not a MegolmPacket)')

		const decryptionResult = packet.decrypt(megolmContext)
		const { plaintext } = decryptionResult
		const payload = cborDecode(plaintext)
		const event = { sender, target, payload }
		client.emit('megolm.packet', event)
	}
}

export function handleMegolmMessage(megolmContext) {
	return function megolmMessageHandler({ sender, target, payload }) {
		if (!(payload instanceof MegolmMessage)) return
		const { client } = megolmContext
		const { text } = payload
		client.emit('megolm.message', { sender, target, text })
	}
}
