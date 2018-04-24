import Olm from 'olm'
import IRC from 'irc-framework'
import { has } from 'lodash'
import { COMMANDS, TAGS, CAPABILITIES } from './constants'
import { awaitMessage } from './utils'

export default function olmMiddleware() {
	const localAccount = new Olm.Account()
	localAccount.create()

	const sessions = new Map()
	const peerIdentities = new Map()

	return function middleware(client, rawEvents, parsedEvents) {
		client.requestCap(CAPABILITIES.MESSAGE_TAGS)
		// client.requestCap('echo-message')
		// client.requestCap('draft/labeled-response')
		addFunctionsToClient(client)
		rawEvents.use(olmProtocolHandler)
	}

	function olmProtocolHandler(command, message, rawLine, client, next) {
		const { nick, tags, params } = message

		// ignore echoed outbound messages
		if (nick === client.user.nick) return next()

		if (command === COMMANDS.TAGMSG) {
			// respond to olm identity requests
			if (has(tags, TAGS.OLM_IDENTITY_REQUEST)) {
				const identityKey = getOwnIdentityKeys().curve25519
				const response = new IRC.Message(COMMANDS.TAGMSG, nick)
				response.tags[TAGS.OLM_IDENTITY] = identityKey
				response.tags[TAGS.REPLY] = tags[TAGS.MSGID]
				client.raw(response)

				return next()
			}

			// respond to olm one-time-key requests
			if (has(tags, TAGS.OLM_ONETIMEKEY_REQUEST)) {
				localAccount.generate_one_time_keys(1)
				const otKeys = JSON.parse(localAccount.one_time_keys())
				const [keyId, key] = Object.entries(otKeys.curve25519)[0]

				const response = new IRC.Message(COMMANDS.TAGMSG, nick)
				response.tags[TAGS.OLM_ONETIMEKEY] = key
				response.tags[TAGS.REPLY] = tags[TAGS.MSGID]
				client.raw(response)

				return next()
			}
		}

		if (command === COMMANDS.PRIVMSG) {
			if (has(tags, TAGS.OLM_MESSAGE)) {
				const [target, jsonData] = params
				const data = JSON.parse(jsonData)
				const { senderKey, encrypted } = data

				if (!sessions.has(senderKey)) {
					// unknown session
					if (encrypted.type !== 0) {
						// message is for a pre-existing session that we don't have
						throw new Error('Cannot decrypt message: session not found')
					}

					// initialize new session
					const session = new Olm.Session()
					session.create_inbound(localAccount, encrypted.body)
					sessions.set(senderKey, session)
				}

				const session = sessions.get(senderKey)
				const decrypted = session.decrypt(encrypted.type, encrypted.body)
				client.emit('secure-message', {
					...message,
					decrypted,
				})
				return next()
			}
		}

		next()
	}

	function getOwnIdentityKeys() {
		return JSON.parse(localAccount.identity_keys())
	}

	function addFunctionsToClient(client) {
		const olm = client.olm = {

			async secureMessage(target, message) {
				const session = await this.getPeerSession(target)
				const encrypted = session.encrypt(message)
				const senderKey = getOwnIdentityKeys().curve25519
				const data = { senderKey, encrypted }
				// TODO: encoding, base122?
				const ircMessage = new IRC.Message(
					COMMANDS.PRIVMSG,
					target,
					JSON.stringify(data)
				)
				ircMessage.tags[TAGS.OLM_MESSAGE] = true
				client.raw(ircMessage)
			},

			async getPeerSession(target) {
				return sessions.get(target) || await this.createPeerSession(target)
			},

			async createPeerSession(target) {
				const targetIdentityKey = await this.getIdentityKey(target)
				const targetOneTimeKey = await this.getOneTimeKey(target)
				const session = new Olm.Session()

				session.create_outbound(localAccount, targetIdentityKey, targetOneTimeKey)

				sessions.set(target, session)
				return session
			},

			async getIdentityKey(target) {
				return peerIdentities.get(target) || await this.requestIdentity(target)
			},

			async requestIdentity(target) {
				const request = new IRC.Message(COMMANDS.TAGMSG, target)
				request.tags[TAGS.OLM_IDENTITY_REQUEST] = true
				client.raw(request)

				const reply = await awaitMessage(client, response =>
					response.command === COMMANDS.TAGMSG &&
					has(response.tags, TAGS.OLM_IDENTITY) &&
					response.nick === target
				)

				const identity = reply.tags[TAGS.OLM_IDENTITY]
				peerIdentities.set(target, identity)
				return identity
			},

			async getOneTimeKey(target) {
				const request = new IRC.Message(COMMANDS.TAGMSG, target)
				request.tags[TAGS.OLM_ONETIMEKEY_REQUEST] = true
				client.raw(request)

				const reply = await awaitMessage(client, response =>
					response.command === COMMANDS.TAGMSG &&
					has(response.tags, TAGS.OLM_ONETIMEKEY) &&
					response.nick === target
				)

				return reply.tags[TAGS.OLM_ONETIMEKEY]
			},

		}
	}
}
