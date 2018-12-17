import cbor from 'cbor'
import { Message as IrcMessage } from 'irc-framework'
import Olm from 'olm'
import { has } from 'lodash'
import { COMMANDS, TAGS } from './constants'
// import { getOtherUsers } from './utils'
import MegolmMessage from './serialization/types/megolm-message'
import MegolmPacket from './serialization/types/megolm-packet'
import { serializeToMessageTagValue } from './serialization/message-tags'
import MegolmSessionState from './serialization/types/megolm-session-state'
import autobind from 'autobind-decorator'
import { toUnpaddedBase64, awaitMessage } from './utils'
import FragmentGenerator from './fragment-generator'

// TODO: make this math more accurate, considering all the tags that the server will add?
// also check if there's a capability that advertises a beyond-spec max length
const MEGOLM_PACKET_VALUE_MAX_LENGTH = 512 - (`@${TAGS.MEGOLM_PACKET}=`.length + ' '.length)

const LABEL_ID_LENGTH = 16

const SPLIT_MEGOLM_PACKET_VALUE_MAX_LENGTH =
	512 -
	(`@${TAGS.MEGOLM_SPLIT_PACKET}=`.length + `;@label=`.length + LABEL_ID_LENGTH + ' '.length)

export default class OutboundGroupSession {
	client
	channelName
	// olmBroker
	syncedPeers = new Set()
	unsyncedPeers = new Set()

	constructor(client, channelName, olmBroker) {
		// store args
		this.client = client
		this.channelName = channelName
		this.olmBroker = olmBroker

		// initialize session
		const session = new Olm.OutboundGroupSession()
		session.create()
		this.session = session
		this.client.on('join', this.onJoin)
		this.shareState()
	}

	shareState() {
		this.client.once('userlist', this.onUserlist)
		this.client.raw('names', this.channelName)
	}

	@autobind
	onUserlist(event) {
		const { channel } = event

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
		const syncedCount = this.syncedPeers.size
		const totalCount = syncedCount + this.unsyncedPeers.size

		const payload = {
			channel: this.channelName,
			syncedCount,
			totalCount,
		}

		this.client.emit('megolm.sync.status', payload)

		console.log('megolm.sync.status', payload)
	}

	@autobind
	onJoin(event) {
		// ignore own joins
		if (this.client.user.nick === event.nick) return

		// ignore already synced peers
		if (this.syncedPeers.has(event.nick)) return

		this.unsyncedPeers.add(event.nick)
		this.emitSyncStatus()
		this.shareStateWith(event.nick)
	}

	async shareStateWith(nick) {
		const { client, syncedPeers, unsyncedPeers, session, emitSyncStatus } = this
		const state = MegolmSessionState.newFromSession(session)
		await client.olm.sendObject(nick, state)
		unsyncedPeers.delete(nick)
		syncedPeers.add(nick)

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

		if (serializedPacket.length > MEGOLM_PACKET_VALUE_MAX_LENGTH) {
			return this.sendFragmented(serializedPacket)
		}

		const ircMessage = new IrcMessage(COMMANDS.TAGMSG, channelName)

		ircMessage.tags[TAGS.MEGOLM_PACKET] = serializedPacket

		return client.raw(ircMessage.to1459()) // shouldn't have to explicitly call this method but there's an instanceof check inside .raw that webpack breaks
	}

	async sendFragmented(serializedPacket) {
		const { channelName } = this
		let previousMsgID
		const fragmentGenerator = new FragmentGenerator(serializedPacket)
		while (fragmentGenerator.more) {
			const chunk = fragmentGenerator.next(SPLIT_MEGOLM_PACKET_VALUE_MAX_LENGTH)
			const labelID = generateLabelID()
			const ircMessage = new IrcMessage(COMMANDS.TAGMSG, channelName)
			ircMessage.tags[TAGS.MEGOLM_PACKET] = chunk
			ircMessage.tags[TAGS.LABEL] = labelID
			if (fragmentGenerator.more) {
				ircMessage.tags[TAGS.FRAGMENTED] = true
			}
			if (previousMsgID) {
				ircMessage.tags[TAGS.PREVIOUS_FRAGMENT] = previousMsgID
			}

			const echoPromise = awaitMessage(
				this.client,
				msg => has(msg.tags, TAGS.LABEL) && msg.tags[TAGS.LABEL] === labelID,
			)

			this.client.raw(ircMessage.to1459()) // HACK

			const echo = await echoPromise
			previousMsgID = echo.tags[TAGS.MSGID]
		}
	}

	sendMessage(text) {
		const message = new MegolmMessage(text)
		return this.sendObject(message)
	}
}

function generateLabelID() {
	const len = 8
	let randomBytes
	if (crypto.randomBytes) {
		randomBytes = crypto.randomBytes(len)
	} else if (crypto.getRandomValues) {
		randomBytes = new Uint8Array(len)
		crypto.getRandomValues(randomBytes)
	} else {
		throw new Error('No crypto.randomBytes or crypto.getRandomValues method available')
	}
	return toUnpaddedBase64(randomBytes)
}
