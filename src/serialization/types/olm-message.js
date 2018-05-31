import CBOR_TAGS from '../constants'
import { Tagged } from 'cbor'

export default class OlmMessage {
	static CBOR_TAG = CBOR_TAGS.OLM_MESSAGE
	text

	constructor(text) {
		this.text = text
	}

	encodeCBOR(encoder) {
		const { text } = this
		const tagged = new Tagged(OlmMessage.CBOR_TAG, text)
		return encoder.pushAny(tagged)
	}

	static decodeCBOR(text) {
		return new OlmMessage(text)
	}
}
