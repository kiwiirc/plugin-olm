import { CAPABILITIES, TAGS } from '../constants'

export function getMessageID(tags, frameworkClient) {
	const enabledCaps = frameworkClient.network.cap.enabled

	if (enabledCaps.includes(CAPABILITIES.MESSAGE_TAGS)) {
		return tags[TAGS.MSGID]
	}

	if (enabledCaps.includes(CAPABILITIES.DRAFT_MESSAGE_TAGS_0_2)) {
		return tags[TAGS.DRAFT_MSGID]
	}
}
