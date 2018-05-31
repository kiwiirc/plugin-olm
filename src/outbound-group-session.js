import cbor from 'cbor'
import IRC from 'irc-framework'
import Olm from 'olm'
import { COMMANDS, TAGS } from './constants'
import { getOtherUsers } from './utils'
import MegolmMessage from './serialization/types/megolm-message'
import MegolmPacket from './serialization/types/megolm-packet'
import { serializeToMessageTagValue } from './serialization/message-tags'
import MegolmSessionState from './serialization/types/megolm-session-state'

export default class OutboundGroupSession {
	client
	channel
	// olmBroker
	syncedPeers = new Set()

	constructor(client, channel, olmBroker) {
		// store args
		this.client = client
		this.channel = channel
		this.olmBroker = olmBroker

		// initialize session
		const session = new Olm.OutboundGroupSession()
		session.create()
		this.session = session
		this.shareState()
	}

	shareState() {
		const { channel, client, syncedPeers, session } = this

		for (const peer of getOtherUsers(channel, client)) {
			if (syncedPeers.has(peer)) {
				continue
			}

			client.olm.sendObject(peer.nick, MegolmSessionState.newFromSession(session))

			syncedPeers.add(peer)
		}
	}

	sendObject(object) {
		const { session, olmBroker, client, channel } = this

		const serializedBuf = cbor.encode(object)

		const ciphertext = session.encrypt(serializedBuf)
		const signature = olmBroker.sign(ciphertext)
		const senderKey = olmBroker.getOwnCurve25519IdentityKey()
		const { sessionID } = MegolmSessionState.newFromSession(session)

		const packet = { ciphertext, signature, senderKey, sessionID }
		const megolmPacket = new MegolmPacket(packet)
		const serializedPacket = serializeToMessageTagValue(megolmPacket)

		const ircMessage = new IRC.Message(COMMANDS.TAGMSG, channel.name)

		ircMessage.tags[TAGS.MEGOLM_PACKET] = serializedPacket

		return client.raw(ircMessage)
	}

	sendMessage(text) {
		const message = new MegolmMessage(text)
		return this.sendObject(message)
	}
}
