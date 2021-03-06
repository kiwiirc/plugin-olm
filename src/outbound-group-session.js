import autobind from 'autobind-decorator'
import cbor from 'cbor'
import { Message as IrcMessage } from 'irc-framework'
import Olm from 'olm'

import { COMMANDS, TAGS } from './constants'
import sendMaybeFragmented from './fragmentation/send-maybe-fragmented'
import { serializeToMessageTagValue } from './serialization/message-tags'
import MegolmMessage from './serialization/types/megolm-message'
import MegolmPacket from './serialization/types/megolm-packet'
import MegolmSessionState from './serialization/types/megolm-session-state'

export default class OutboundGroupSession {
	client
	channelName
	olmBroker
	syncedPeers /* = new Set() */
	unsyncedPeers = new Set()
	session

	constructor({
		client,
		channelName,
		olmBroker,
		shouldInitiateKeyExchange = (/* outboundGroupSession */) => true,
		session = (() => {
			const session = new Olm.OutboundGroupSession()
			session.create()
			return session
		})(),
	}) {
		this.client = client
		this.channelName = channelName
		this.olmBroker = olmBroker
		this.shouldInitiateKeyExchange = shouldInitiateKeyExchange
		this.session = session

		this.syncedPeers = this.client.olm.store.createMegolmSyncedUsersStore(this.channelName)

		this.client.on('join', this.onJoin)
		this.client.on('nick', this.onNick)
		this.shareState()
	}

	shareState() {
		this.client.once('userlist', this.onUserlist)
		this.client.raw('names', this.channelName)
	}

	@autobind
	onUserlist(event) {
		if (!this.shouldInitiateKeyExchange(this)) return

		let syncStatusChanged = false

		// add all unsynced users to queue
		for (const user of event.users) {
			// skip self
			if (this.client.user.nick === user.nick) continue

			if (!this.syncedPeers.has(user.nick)) {
				this.unsyncedPeers.add(user.nick)
				syncStatusChanged = true
			}
		}

		if (syncStatusChanged) {
			this.emitSyncStatus()
		}

		for (const nick of this.unsyncedPeers) {
			// TODO: queue
			this.shareStateWith(nick)
		}
	}

	@autobind
	emitSyncStatus() {
		const { syncedPeers, unsyncedPeers } = this

		const payload = {
			channelName: this.channelName,
			networkName: this.client.network.name,
			syncedPeers,
			unsyncedPeers,
		}

		this.client.emit('megolm.sync.status', payload)
	}

	@autobind
	onJoin(event) {
		// ignore own joins
		if (this.client.user.nick === event.nick) return

		if (!this.shouldInitiateKeyExchange(this)) return

		// TODO: remove users on part/quit/kick
		// ignore already synced peers
		// if (this.syncedPeers.has(event.nick)) return

		if (this.syncedPeers.has(event.nick)) {
			return
		}

		this.unsyncedPeers.add(event.nick)
		this.emitSyncStatus()
		this.shareStateWith(event.nick)
	}

	@autobind
	onNick({ nick, ident, hostname, new_nick, time }) {
		this.syncedPeers.delete(nick)
		this.syncedPeers.add(new_nick)
		this.emitSyncStatus()
	}

	async shareStateWith(nick) {
		const { client, syncedPeers, unsyncedPeers, session, emitSyncStatus } = this
		const state = MegolmSessionState.newFromSession(session)
		await client.olm.sendObject(nick, state)
		unsyncedPeers.delete(nick)
		syncedPeers.add(nick)
		console.debug(`OutboundGroupSession: shared ${this.channelName} state with ${nick}`)

		emitSyncStatus()
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

		return sendMaybeFragmented(ircMessage, client)
	}

	sendMessage(text) {
		const message = new MegolmMessage(text)
		return this.sendObject(message)
	}
}
