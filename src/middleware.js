import { Channel as IrcChannel } from 'irc-framework'
import { CAPABILITIES } from './constants'
import MegolmBroker from './megolm-broker'
import OlmBroker from './olm-broker'

export default function olmMiddleware() {
	return function middleware(client, rawEvents /* , parsedEvents */) {
		const olmBroker = new OlmBroker({ client, rawEvents })
		const megolmBroker = new MegolmBroker({ client, olmBroker, rawEvents }) // eslint-disable-line no-unused-vars

		addFunctionsToClient(client)
	}

	function addFunctionsToClient(client) {
		client.olm = {
			...(client.olm || {}),
			async sendMessage(target, message) {
				if (target instanceof IrcChannel) {
					target = target.name
				}
				if (client.network.isChannelName(target)) {
					return client.olm.sendGroupMessage(target, message)
				}
				return client.olm.sendDirectMessage(target, message)
			},
			async sendObject(target, object) {
				if (target instanceof IrcChannel) {
					target = target.name
				}
				if (client.network.isChannelName(target)) {
					return client.olm.sendGroupObject(target, object)
				}
				return client.olm.sendDirectObject(target, object)
			},
		}
	}
}
