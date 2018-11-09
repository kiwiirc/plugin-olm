import cbor from 'cbor'
import { Message as IrcMessage } from 'irc-framework'
import Olm from 'olm'
import { COMMANDS, TAGS } from './constants'
// import { getOtherUsers } from './utils'
import MegolmMessage from './serialization/types/megolm-message'
import MegolmPacket from './serialization/types/megolm-packet'
import { serializeToMessageTagValue } from './serialization/message-tags'
import MegolmSessionState from './serialization/types/megolm-session-state'
import autobind from 'autobind-decorator'

export default class OutboundGroupSession {
	client
	channelName
	// olmBroker
	syncedPeers = new Set()

	constructor(client, channelName, olmBroker) {
		// store args
		this.client = client
		this.channelName = channelName
		this.olmBroker = olmBroker

		// initialize session
		const session = new Olm.OutboundGroupSession()
		session.create()
		this.session = session
		// this.shareState()
		client.on('userlist', this.onUserlist)
		client.on('join', this.onJoin)
		client.raw('names', channelName)
	}

	@autobind
	onUserlist(event) {
		for (const user of event.users) {
			this.shareStateWith(user.nick)
		}
	}

	@autobind
	onJoin(event) {
		// ignore own joins
		if (this.client.user.nick === event.nick) return

		// ignore already synced peers
		if (this.syncedPeers.has(event.nick)) return

		this.shareStateWith(event.nick)
	}

	shareStateWith(nick) {
		const { client, syncedPeers, session } = this
		const state = MegolmSessionState.newFromSession(session)
		client.olm.sendObject(nick, state)
		syncedPeers.add(nick)
	}

	sendObject(object) {
		const { session, olmBroker, client, channelName } = this

		const serializedBuf = cbor.encode(object)

		const ciphertext = session.encrypt(serializedBuf)
		const signature = olmBroker.sign(ciphertext)
		const senderKey = olmBroker.getOwnCurve25519IdentityKey()
		const { sessionID } = MegolmSessionState.newFromSession(session)

		const packet = { ciphertext, signature, senderKey, sessionID }
		const megolmPacket = new MegolmPacket(packet)
		const serializedPacket = serializeToMessageTagValue(megolmPacket)

		const ircMessage = new IrcMessage(COMMANDS.TAGMSG, channelName)

		ircMessage.tags[TAGS.MEGOLM_PACKET] = serializedPacket

		return client.raw(ircMessage.to1459()) // shouldn't have to explicitly call this method but there's an instanceof check inside .raw that webpack breaks
	}

	sendMessage(text) {
		const message = new MegolmMessage(text)
		return this.sendObject(message)
	}
}
