// import assert from 'assert' // eslint-disable-line import/no-nodejs-modules

import autobind from 'autobind-decorator'
import { Message as IrcMessage } from 'irc-framework'
import { has } from 'lodash'
import Olm from 'olm'

import { COMMANDS, TAGS } from './constants'
import {
	handleOlmIdentityRequest,
	handleOlmMessage,
	handleOlmOneTimeKeyRequest,
	handleOlmPacket,
} from './olm-handlers'
import {
	deserializeFromMessageTagValue,
	serializeToMessageTagValue,
} from './serialization/message-tags'
import OlmMessage from './serialization/types/olm-message'
import OlmOneTimeKey from './serialization/types/olm-onetimekey'
import OlmPacket from './serialization/types/olm-packet'
import { awaitMessage } from './utils'

export default class OlmBroker {
	client
	localAccount = new Olm.Account()
	sessions = new Map()
	peerIdentities = new Map()
	rawHandlers

	constructor({ client, rawEvents }) {
		this.client = client
		this.localAccount.create()
		this.registerEventListeners(rawEvents)
		this.addFunctionsToClient()
		this.rawHandlers = [
			handleOlmPacket,
			handleOlmIdentityRequest,
			handleOlmOneTimeKeyRequest,
		].map(handler => handler(this))
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

	async getPeerSession(target) {
		return this.sessions.get(target) || (await this.createPeerSession(target))
	}

	async createPeerSession(target) {
		const targetIdentityKey = await this.getPeerIdentityKey(target)
		const targetOneTimeKey = await this.getPeerOneTimeKey(target)
		const session = new Olm.Session()

		session.create_outbound(this.localAccount, targetIdentityKey, targetOneTimeKey)

		this.sessions.set(target, session)
		return session
	}

	async getPeerIdentityKey(target) {
		const identity = this.peerIdentities.get(target) || (await this.requestPeerIdentity(target))
		return identity.curve25519IdentityKeyBase64
	}

	async requestPeerIdentity(target) {
		const request = new IrcMessage(COMMANDS.TAGMSG, target)
		request.tags[TAGS.OLM_IDENTITY_REQUEST] = true
		this.client.raw(request.to1459()) // HACK: .to1459()

		const reply = await awaitMessage(this.client, response => {
			if (response.command !== COMMANDS.TAGMSG) return false
			if (!has(response.tags, TAGS.OLM_IDENTITY)) return false
			if (response.nick !== target) return false
			return true
		})

		const identity = deserializeFromMessageTagValue(reply.tags[TAGS.OLM_IDENTITY])
		this.peerIdentities.set(target, identity)
		return identity
	}

	async getPeerOneTimeKey(target) {
		const request = new IrcMessage(COMMANDS.TAGMSG, target)
		request.tags[TAGS.OLM_ONETIMEKEY_REQUEST] = true
		this.client.raw(request.to1459()) // HACK: .to1459()

		const reply = await awaitMessage(this.client, response => {
			if (
				response.command === COMMANDS.TAGMSG &&
				has(response.tags, TAGS.OLM_ONETIMEKEY) &&
				response.nick === target
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

	@autobind
	rawEventsHandler(command, message, rawLine, client, next) {
		const {
			nick: sender,
			tags,
			params: [target, text],
		} = message

		for (const handler of this.rawHandlers) {
			handler({ sender, tags, command, target, text, client, rawLine })
		}

		next()
	}

	registerEventListeners(rawEvents) {
		rawEvents.use(this.rawEventsHandler)
		this.client.on('olm.packet', handleOlmMessage(this))
	}

	addFunctionsToClient() {
		const { client } = this
		const olmBroker = this

		async function sendDirectMessage(target, message) {
			sendDirectObject(target, new OlmMessage(message))
		}

		async function sendDirectObject(target, payload) {
			const packet = await OlmPacket.encryptNew(payload, target, olmBroker)
			const ircMessage = new IrcMessage(COMMANDS.TAGMSG, target)
			ircMessage.tags[TAGS.OLM_PACKET] = serializeToMessageTagValue(packet)
			client.raw(ircMessage.to1459()) // shouldn't have to explicitly call this method but there's an instanceof check inside .raw that webpack breaks
		}

		client.olm = {
			...(client.olm || {}),
			sendDirectMessage,
			sendDirectObject,
		}
	}
}
