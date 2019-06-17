import { CAPABILITIES, TAGS } from '../constants'

export function getLabel(tags, frameworkClient) {
	const enabledCaps = frameworkClient.network.cap.enabled

	if (enabledCaps.includes(CAPABILITIES.LABELED_RESPONSE)) {
		return tags[TAGS.LABEL]
	}

	if (enabledCaps.includes(CAPABILITIES.DRAFT_LABELED_RESPONSE)) {
		return tags[TAGS.DRAFT_LABEL]
	}
}
