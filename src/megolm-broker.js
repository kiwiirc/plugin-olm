import autobind from 'autobind-decorator'
import OutboundGroupSession from './outbound-group-session'
import { handleMegolmState, handleMegolmMessage, handleMegolmPacket } from './megolm-handlers'

export default class MegolmBroker {
	client
	defragmentedMessages
	olmBroker
	outboundSessions = new Map()
	inboundSessions = new Map()

	constructor({ client, defragmentedMessages, olmBroker }) {
		this.client = client
		this.defragmentedMessages = defragmentedMessages
		this.olmBroker = olmBroker
		this.registerEventListeners()
		this.addFunctionsToClient()
	}

	@autobind
	async sendGroupMessage(target, message) {
		const session = await this.getGroupSession(target)
		return session.sendMessage(message)
	}

	@autobind
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

	registerEventListeners() {
		const { client, defragmentedMessages } = this

		const messageHandlers = [handleMegolmPacket]

		for (const handler of messageHandlers) {
			defragmentedMessages.subscribe(handler(this))
		}

		client.on('olm.packet', handleMegolmState(this))
		client.on('megolm.packet', handleMegolmMessage(this))
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
