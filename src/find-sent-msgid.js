import { isMatch, isEqual } from 'lodash'
import awaitMessage from './await-message'

export default async function findSentMsgId(ircClient, sentMessage) {
	const matcher = receivedMessage => {
			// command must match
			if (receivedMessage.command !== sentMessage.command) return false

			// received tags must be superset of sent tags
			// danger: if server strips some of our tags, we won't find the message
			if (!isMatch(receivedMessage.tags, sentMessage.tags)) return false

			// params must match
			if (!isEqual(receivedMessage.params, sentMessage.params)) return false

			// ~~~prefix must match our identity~~~
			// checking only nick because irc-framework is not aware of our own hostname
			// danger: this is racy with nick changes
			if (receivedMessage.nick !== ircClient.user.nick) return false

			return true
	}

	const foundMessage = await awaitMessage(ircClient, matcher)
	const msgid = foundMessage.tags['draft/msgid']

	if (msgid === undefined) debugger
	return msgid
}
