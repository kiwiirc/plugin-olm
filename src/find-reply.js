import { isMatch, isEqual, has } from 'lodash'
import awaitMessage from './await-message'

const REPLY_TAG = '+draft/reply'

export default async function findReply(ircClient, msgId) {
	const matcher = receivedMessage => {
			const { tags } = receivedMessage
			// message must be a reply
			if (!has(tags, REPLY_TAG)) return false

			const replyTo = tags[REPLY_TAG]

			// must be a reply to the specified msgId
			if (replyTo !== msgId) {
				return false
			}

			return true
	}

	const foundMessage = await awaitMessage(ircClient, matcher)

	return foundMessage
}
