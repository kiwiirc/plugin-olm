import { CAPABILITIES, TAGS } from '../constants'
import hasOwnProp from 'has-own-prop'

export function setLabel(tags, frameworkClient, label) {
	const enabledCaps = frameworkClient.network.cap.enabled

	let labelTag

	if (enabledCaps.includes(CAPABILITIES.LABELED_RESPONSE)) {
		labelTag = TAGS.LABEL
	} else if (enabledCaps.includes(CAPABILITIES.DRAFT_LABELED_RESPONSE)) {
		labelTag = TAGS.DRAFT_LABEL
	} else {
		throw new Error('labeled-response capability not enabled')
	}

	if (hasOwnProp(tags, labelTag)) {
		throw new Error('Label already set')
	}

	tags[labelTag] = label
}
