import autobind from 'autobind-decorator'
import OutboundGroupSession from './outbound-group-session'
import {
	handleMegolmState,
	handleMegolmPacket,
	handleMegolmMessage,
	shareStateOnJoin,
} from './megolm-handlers'

export default class MegolmBroker {
	client
	olmBroker
	outboundSessions = new Map()
	inboundSessions = new Map()
	rawHandlers

	constructor({ client, olmBroker, rawEvents }) {
		this.client = client
		this.olmBroker = olmBroker
		this.registerEventListeners(rawEvents)
		this.addFunctionsToClient()
		this.rawHandlers = [handleMegolmPacket].map(handler => handler(this))
	}

	@autobind
	async sendGroupMessage(target, message) {
		const session = await this.getGroupSession(target)
		return session.sendMessage(message)
	}

	async getGroupSession(target) {
		return this.outboundSessions.get(target) || (await this.createGroupSession(target))
	}

	async createGroupSession(target) {
		const session = new OutboundGroupSession(this.client, target, this.olmBroker)
		this.outboundSessions.set(target, session)
		return session
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
		const { client, rawEventsHandler } = this
		rawEvents.use(rawEventsHandler)
		client.on('olm.packet', handleMegolmState(this))
		client.on('megolm.packet', handleMegolmMessage(this))
		client.on('join', shareStateOnJoin(this))
	}

	addFunctionsToClient() {
		const { client, sendGroupMessage } = this

		client.olm = {
			...(client.olm || {}),
			sendGroupMessage,
		}
	}
}
