import autobind from 'autobind-decorator'
import hasOwnProp from 'has-own-prop'
import { Message as IrcMessage } from 'irc-framework'
import Olm from 'olm'

import { COMMANDS, TAGS } from './constants'
import sendMaybeFragmented from './fragmentation/send-maybe-fragmented'
import {
	deserializeFromMessageTagValue,
	serializeToMessageTagValue,
} from './serialization/message-tags'
import OlmIdentity from './serialization/types/olm-identity'
import OlmMessage from './serialization/types/olm-message'
import OlmOneTimeKey from './serialization/types/olm-onetimekey'
import OlmPacket from './serialization/types/olm-packet'
import { awaitMessage } from './utils/awaitMessage'
import moveMapEntry from './utils/moveMapEntry'

export default class OlmBroker {
	client
	defragmentedMessages
	localAccount
	peerIdentities
	sessions

	constructor({ client, defragmentedMessages, account }) {
		this.client = client
		this.defragmentedMessages = defragmentedMessages
		this.localAccount = account
		this.peerIdentities = client.olm.store.peerIdentities
		this.sessions = client.olm.store.olmSessions
		this.registerEventListeners()
		this.addFunctionsToClient()
	}

	sign(message) {
		return this.localAccount.sign(message)
	}

	getOwnIdentityKeys() {
		return JSON.parse(this.localAccount.identity_keys())
	}

	getOwnCurve25519IdentityKey() {
		return this.getOwnIdentityKeys().curve25519
	}

	getOrCreateSessionFromPacket(olmPacket) {
		const { sessions } = this
		const { senderKeyBase64 } = olmPacket

		const session = sessions.get(senderKeyBase64)

		if (session) {
			return session
		}

		// unknown session

		if (olmPacket.encryptionResult.type !== 0) {
			// message is part of a pre-existing session that we're missing
			// TODO: renegoatate session when error occurs
			throw new Error('Cannot decrypt message: unknown session continuation')
		}

		const newSession = olmPacket.createInboundSession(this)
		sessions.set(senderKeyBase64, newSession)
		return newSession
	}

	async getPeerSession(nick) {
		const identityKey = this.peerIdentities.get(nick)
		if (identityKey) {
			const existingSession = this.sessions.get(identityKey)
			if (existingSession) return existingSession
		}
		return await this.createPeerSession(nick)
	}

	async createPeerSession(nick) {
		const targetIdentityKey = await this.getPeerIdentityKey(nick)
		const targetOneTimeKey = await this.getPeerOneTimeKey(nick)
		const session = new Olm.Session()

		session.create_outbound(this.localAccount, targetIdentityKey, targetOneTimeKey)

		this.sessions.set(targetIdentityKey, session)
		return session
	}

	async getPeerIdentityKey(nick) {
		return this.peerIdentities.get(nick) || (await this.requestPeerIdentityKey(nick))
	}

	async requestPeerIdentityKey(nick) {
		const request = new IrcMessage(COMMANDS.TAGMSG, nick)
		request.tags[TAGS.OLM_IDENTITY_REQUEST] = true
		this.client.raw(request.to1459()) // HACK: .to1459()

		const reply = await awaitMessage(this.client, response => {
			if (response.command !== COMMANDS.TAGMSG) return false
			if (!hasOwnProp(response.tags, TAGS.OLM_IDENTITY)) return false
			if (response.nick !== nick) return false
			return true
		})

		const identity = deserializeFromMessageTagValue(reply.tags[TAGS.OLM_IDENTITY])
		const identityKey = identity.curve25519IdentityKeyBase64
		this.peerIdentities.set(nick, identityKey)
		return identityKey
	}

	async getPeerOneTimeKey(nick) {
		const request = new IrcMessage(COMMANDS.TAGMSG, nick)
		request.tags[TAGS.OLM_ONETIMEKEY_REQUEST] = true
		this.client.raw(request.to1459()) // HACK: .to1459()

		const reply = await awaitMessage(this.client, response => {
			if (
				response.command === COMMANDS.TAGMSG &&
				hasOwnProp(response.tags, TAGS.OLM_ONETIMEKEY) &&
				response.nick === nick
			) {
				return true
			}
			return false
		})

		const otkObj = deserializeFromMessageTagValue(reply.tags[TAGS.OLM_ONETIMEKEY])
		if (!(otkObj instanceof OlmOneTimeKey)) {
			throw new TypeError('deserialized reply was not an OlmOneTimeKey')
		}
		return otkObj.oneTimeKeyBase64
	}

	registerEventListeners() {
		const { defragmentedMessages, client } = this

		const messageHandlers = [
			this.handleOlmPacket,
			this.handleOlmIdentityRequest,
			this.handleOlmOneTimeKeyRequest,
		]

		for (const handler of messageHandlers) {
			defragmentedMessages.subscribe(handler)
		}

		client.on('olm.packet', this.handleOlmMessage)
		client.on('nick', this.onNick)
	}

	@autobind
	handleOlmPacket(event) {
		const {
			nick: sender,
			tags,
			command,
			params: [target],
		} = event

		if (command !== COMMANDS.TAGMSG) return
		if (!hasOwnProp(tags, TAGS.OLM_PACKET)) return

		if (sender === this.client.user.nick) return // ignore self

		const packet = deserializeFromMessageTagValue(tags[TAGS.OLM_PACKET])
		if (!(packet instanceof OlmPacket)) throw new TypeError('not an OlmPacket')

		// update nick->senderkey mapping
		this.peerIdentities.set(sender, packet.senderKeyBase64)

		let payload
		try {
			payload = packet.decrypt(this)
		} catch (error) {
			this.client.emit('olm.packet.error', { sender, target, error })
			return
		}
		const packetEvent = { sender, target, payload }
		this.client.emit('olm.packet', packetEvent)
	}

	@autobind
	handleOlmIdentityRequest(event) {
		const {
			nick: sender,
			tags,
			command,
			params: [target],
		} = event

		if (command !== COMMANDS.TAGMSG) return
		if (!hasOwnProp(tags, TAGS.OLM_IDENTITY_REQUEST)) return

		if (sender === this.client.user.nick) return // ignore self

		const identity = new OlmIdentity(this.getOwnCurve25519IdentityKey())

		const response = new IrcMessage(COMMANDS.TAGMSG, sender)
		response.tags[TAGS.OLM_IDENTITY] = serializeToMessageTagValue(identity)
		if (hasOwnProp(tags, TAGS.MSGID)) {
			response.tags[TAGS.REPLY] = tags[TAGS.MSGID]
		}
		this.client.raw(response.to1459()) // HACK: .to1459()
	}

	@autobind
	handleOlmOneTimeKeyRequest(event) {
		const {
			nick: sender,
			tags,
			command,
			params: [target],
		} = event

		if (command !== COMMANDS.TAGMSG) return
		if (!hasOwnProp(tags, TAGS.OLM_ONETIMEKEY_REQUEST)) return

		if (sender === this.client.user.nick) return // ignore self

		const response = new IrcMessage(COMMANDS.TAGMSG, sender)

		response.tags[TAGS.OLM_ONETIMEKEY] = serializeToMessageTagValue(
			OlmOneTimeKey.generate(this.localAccount),
		)

		if (hasOwnProp(tags, TAGS.MSGID)) {
			response.tags[TAGS.REPLY] = tags[TAGS.MSGID]
		}

		this.client.raw(response.to1459()) // HACK: .to1459()
	}

	@autobind
	handleOlmMessage(event) {
		const { sender, target, payload } = event
		if (!(payload instanceof OlmMessage)) return

		const { text } = payload

		this.client.emit('olm.message', { sender, target, text })
	}

	@autobind
	onNick({ nick, ident, hostname, new_nick, time }) {
		const { client, peerIdentities } = this
		if (nick === client.user.nick) return // ignore self

		moveMapEntry(peerIdentities, nick, new_nick)
	}

	addFunctionsToClient() {
		const { client } = this
		const olmBroker = this

		async function sendDirectMessage(nick, message) {
			return sendDirectObject(nick, new OlmMessage(message))
		}

		async function sendDirectObject(nick, payload) {
			const packet = await OlmPacket.encryptNew(payload, nick, olmBroker)
			const ircMessage = new IrcMessage(COMMANDS.TAGMSG, nick)
			ircMessage.tags[TAGS.OLM_PACKET] = serializeToMessageTagValue(packet)
			return sendMaybeFragmented(ircMessage, client)
		}

		client.olm = {
			...(client.olm || {}),
			sendDirectMessage,
			sendDirectObject,
		}
	}
}
