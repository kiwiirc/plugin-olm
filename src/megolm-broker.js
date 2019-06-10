import autobind from 'autobind-decorator'
import hasOwnProp from 'has-own-prop'
import Olm from 'olm'

import { COMMANDS, TAGS } from './constants'
import OutboundGroupSession from './outbound-group-session'
import cborDecode from './serialization/cbor-decoder'
import { deserializeFromMessageTagValue } from './serialization/message-tags'
import MegolmMessage from './serialization/types/megolm-message'
import MegolmPacket from './serialization/types/megolm-packet'
import MegolmSessionState from './serialization/types/megolm-session-state'

export default class MegolmBroker {
	client
	defragmentedMessages
	olmBroker
	shouldInitiateKeyExchange
	outboundSessions // channelName -> OutboundGroupSession
	inboundSessions // sessionID -> Olm.InboundGroupSession

	constructor({
		client,
		defragmentedMessages,
		olmBroker,
		shouldInitiateKeyExchange = session => true,
	}) {
		this.client = client
		this.defragmentedMessages = defragmentedMessages
		this.olmBroker = olmBroker
		this.shouldInitiateKeyExchange = shouldInitiateKeyExchange
		this.outboundSessions = client.olm.store.outboundMegolmSessions
		this.inboundSessions = client.olm.store.inboundMegolmSessions
		this.registerEventListeners()
		this.addFunctionsToClient()
	}

	@autobind
	async sendGroupMessage(channelName, message) {
		const session = await this.getGroupSession(channelName)
		return session.sendMessage(message)
	}

	@autobind
	async getGroupSession(channelName) {
		return (
			this.outboundSessions.get(channelName) || (await this.createGroupSession(channelName))
		)
	}

	async createGroupSession(channelName) {
		const { client, olmBroker, shouldInitiateKeyExchange } = this
		const session = new OutboundGroupSession({
			client,
			channelName,
			olmBroker,
			shouldInitiateKeyExchange,
		})
		this.outboundSessions.set(channelName, session)
		return session
	}

	registerEventListeners() {
		const { client, defragmentedMessages } = this

		defragmentedMessages.subscribe(this.megolmPacketHandler)

		client.on('olm.packet', this.megolmStateHandler)
		client.on('megolm.packet', this.megolmMessageHandler)
	}

	@autobind
	megolmPacketHandler(event) {
		const {
			nick: sender,
			tags,
			command,
			params: [target, text],
		} = event

		if (command !== COMMANDS.TAGMSG) return
		if (!hasOwnProp(tags, TAGS.MEGOLM_PACKET)) return
		if (sender === this.client.user.nick) return // ignore own messages

		const { client } = this
		const packet = deserializeFromMessageTagValue(tags[TAGS.MEGOLM_PACKET])
		if (!(packet instanceof MegolmPacket)) throw new TypeError('not a MegolmPacket')

		let decryptionResult
		try {
			decryptionResult = packet.decrypt(this)
		} catch (error) {
			client.emit('megolm.packet.error', { sender, target, error })
			return
		}
		const { plaintext } = decryptionResult
		const payload = cborDecode(plaintext)
		const packetEvent = { sender, target, payload }
		client.emit('megolm.packet', packetEvent)
	}

	@autobind
	megolmStateHandler({ payload /* sender, target */ }) {
		if (!(payload instanceof MegolmSessionState)) return
		const { /* messageIndex, */ sessionKeyBase64, sessionIDBase64 } = payload
		const session = new Olm.InboundGroupSession()
		session.create(sessionKeyBase64)
		this.inboundSessions.set(sessionIDBase64, session)
		console.debug('Created', session, 'from', payload)
	}

	@autobind
	megolmMessageHandler({ sender, target, payload }) {
		if (!(payload instanceof MegolmMessage)) return
		const { text } = payload
		this.client.emit('megolm.message', { sender, target, text })
	}

	addFunctionsToClient() {
		const { client, sendGroupMessage, getGroupSession } = this

		client.olm = {
			...(client.olm || {}),
			sendGroupMessage,
			getGroupSession,
		}
	}
}
