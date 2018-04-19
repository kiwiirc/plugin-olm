import findSentMsgId from './find-sent-msgid'
import findReply from './find-reply'

export default async function executeRequest(ircClient, requestMessage) {
	// prepare to capture msg-id
	const msgIdPromise = findSentMsgId(ircClient, requestMessage)

	// send message
	ircClient.raw(requestMessage)

	// find msgid
	const msgId = await msgIdPromise

	// wait for reply
	const reply = await findReply(ircClient, msgId)

	return reply
}
