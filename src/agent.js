import IRC from 'irc-framework'
import Olm from 'olm'
import Haikunator from 'haikunator'
import { format } from 'date-fns'
import { hsluvToHex } from 'hsluv'
import chalk from 'chalk'
import { has } from 'lodash'
import findSentMsgId from './find-sent-msgid'
import findReply from './find-reply'
import executeRequest from './execute-request';

const haikunator = new Haikunator()
const generateRandomName = () => haikunator.haikunate()

const seconds = 1000

export default class Agent {
	constructor() {
		this.ircClient = new IRC.Client()
		this.ircClient.requestCap('draft/message-tags-0.2')
		this.ircClient.requestCap('echo-message')

		this.olmIdentity = new Olm.Account()
		this.olmIdentity.create()

		this.color = chalk.hex(hsluvToHex([Math.random()*360, 75, 50]))

		this.channels = new Map()
		this.channelsAwaitingUsers = new WeakSet()
		this.sessions = new Map()
		this.peerIdentities = new Map()

		const { ircClient, onRaw, onRegistered, onJoin, onUserlist, onMessage } = this
		ircClient.on('raw', onRaw, this)
		ircClient.on('registered', onRegistered, this)
		ircClient.on('join', onJoin, this)
		ircClient.on('userlist', onUserlist, this)

		// TAGMSG doesn't emit through client.on('message', ...
		ircClient.connection.on('message', onMessage, this)
	}

	connect(options) {
		return new Promise((resolve, reject) => {
			const { ircClient } = this
			const onRegistered = event => {
				ircClient.removeListener('registered', onRegistered)
				resolve(event)
			}
			ircClient.on('registered', onRegistered)

			const nick = generateRandomName()

			ircClient.connect({
				...options,
				nick,
			})
		})
	}

	onRaw(event) {
		const timestamp = format(new Date(), 'hh:mm:ss.SSS')
		const direction = event.from_server ? '⇦' : '➡'
		console.log(this.color(`${timestamp} ${direction} ${event.line}`))
	}

	join(channelName) {
		if (this.channels.has(channelName)) {
			throw new Error(`Already have channel object for ${channelName}`)
		}
		const channel = this.ircClient.channel(channelName)
		this.channels.set(channelName, channel)
		channel.join()
	}

	onRegistered(event) {
		this.join('#e2e-test')
	}

	onJoin(event) {
		const channel = this.channels.get(event.channel)
		this.channelsAwaitingUsers.add(channel)
	}

	onUserlist(event) {
		const channel = this.channels.get(event.channel)
		if (this.channelsAwaitingUsers.has(channel)) {
			this.channelsAwaitingUsers.delete(channel)
			this.gossip(channel)
			setInterval(() => this.gossip(channel), 5*seconds)
		}
	}

	gossip(channel) {
		const otherUsers = channel.users.filter(user => user.nick !== this.ircClient.user.nick)
		for (const user of otherUsers) {
			// this.secureMessage(`${user.nick}!${user.ident}@${user.hostname}`, 'hey')
			this.secureMessage(user.nick, `psst. secret number: ${Math.random()}`)
		}
	}

	async secureMessage(target, message) {
		const session = await this.getPeerSession(target)
		// TODO: tag message
		const encrypted = session.encrypt(message)

		const senderKey = JSON.parse(this.olmIdentity.identity_keys()).curve25519
		const data = { senderKey, encrypted }

		const ircMessage = new IRC.Message('PRIVMSG', target, JSON.stringify(data)) // TODO: encoding, base122?
		ircMessage.tags['+kiwi/olm-message'] = true
		this.ircClient.raw(ircMessage)
	}

	async getPeerSession(target) {
		if (!this.sessions.has(target)) {
			await this.createPeerSession(target)
		}

		return this.sessions.get(target)
	}

	async createPeerSession(target) {
		const identityKey = await this.getIdentityKey(target)
		const oneTimeKey = await this.getOneTimeKey(target)
		const session = new Olm.Session()

		session.create_outbound(this.olmIdentity, identityKey, oneTimeKey)

		this.sessions.set(target, session)
	}

	async getIdentityKey(target) {
		if (!this.peerIdentities.has(target)) {
			await this.requestIdentity(target)
		}

		return this.peerIdentities.get(target)
	}

	async requestIdentity(target) {
		const request = new IRC.Message('TAGMSG', target)
		request.tags['+kiwi/e2e-identity-request'] = true

		const reply = await executeRequest(this.ircClient, request)

		const identity = reply.tags['+kiwi/olm-identity']
		this.peerIdentities.set(target, identity)
	}

	async getOneTimeKey(target) {
		const request = new IRC.Message('TAGMSG', target)
		request.tags['+kiwi/e2e-otk-request'] = true

		const reply = await executeRequest(this.ircClient, request)

		const key = reply.tags['+kiwi/olm-otk']
		console.log(`got otk: ${key}`)
		return key
	}

	onMessage(message) {
		const { nick: source, command, tags, params } = message
		try {
			switch (command) {
				case 'TAGMSG':
					// don't reply to echoes of our sent requests
					if (params[0] !== this.ircClient.user.nick) {
						return // we aren't the target
					}

					// respond to olm identity requests
					if (has(tags, "+kiwi/e2e-identity-request")) {
						const identityKeys = JSON.parse(this.olmIdentity.identity_keys())
						const identityKey = identityKeys.curve25519
						const response = new IRC.Message('TAGMSG', message.nick) // TODO: use whole prefix when oregano is fixed
						response.tags['+kiwi/olm-identity'] = identityKey
						response.tags['+draft/reply'] = tags['draft/msgid']
						this.ircClient.raw(response)
						return
					}

					// respond to olm one-time-key requests
					if (has(tags, '+kiwi/e2e-otk-request')) {
						this.olmIdentity.generate_one_time_keys(1)
						const otKeys = JSON.parse(this.olmIdentity.one_time_keys())
						const [keyId, key] = Object.entries(otKeys.curve25519)[0]

						const response = new IRC.Message('TAGMSG', message.nick)
						response.tags['+kiwi/olm-otk'] = key
						response.tags['+draft/reply'] = tags['draft/msgid']
						this.ircClient.raw(response)
						console.log(`sent otk: ${key}`)
						// this.olmIdentity.mark_keys_as_published()
						return
					}
					break;
				case 'PRIVMSG':
					const [target, jsonData] = params

					// ignore our sent messages
					if (source === this.ircClient.user.nick) {
						return
					}

					if (has(tags, '+kiwi/olm-message')) {
						const data = JSON.parse(jsonData)
						const { senderKey, encrypted } = data

						if (!this.sessions.has(senderKey)) {
							// unknown session
							if (encrypted.type !== 0) {
								// message is for a pre-existing session that we don't have
								throw new Error('Cannot decrypt message: session not found')
							}

							// initialize new session
							const session = new Olm.Session()
							session.create_inbound(this.olmIdentity, encrypted.body)
							this.sessions.set(senderKey, session)
						}

						const session = this.sessions.get(senderKey)
						const decrypted = session.decrypt(encrypted.type, encrypted.body)
						console.log(`${source} ⇶ ${this.color(target)}: ${decrypted}`)
						return
					}
					break;
			}
		} catch (err) {
			console.log(`error handling message: ${err}`)
		}
	}
}
