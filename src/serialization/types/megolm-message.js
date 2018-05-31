import CBOR_TAGS from '../constants'
import { Tagged } from 'cbor'

export default class MegolmMessage {
	static CBOR_TAG = CBOR_TAGS.MEGOLM_MESSAGE
	text

	constructor(text) {
		this.text = text
	}

	encodeCBOR(encoder) {
		const { text } = this
		const tagged = new Tagged(MegolmMessage.CBOR_TAG, text)
		return encoder.pushAny(tagged)
	}

	static decodeCBOR(text) {
		return new MegolmMessage(text)
	}
}
