import { Tagged } from 'cbor'
import { toUnpaddedBase64 } from '../../utils/toUnpaddedBase64'
import { toBuffer } from '../../utils/toBuffer'
import { toByteArray } from '../../utils/toByteArray'
import { onlyObjectValue } from '../../utils/onlyObjectValue'
import CBOR_TAGS from '../constants'

export default class OlmOneTimeKey {
	static CBOR_TAG = CBOR_TAGS.OLM_ONETIMEKEY
	oneTimeKey

	constructor(oneTimeKey) {
		this.oneTimeKey = toByteArray(oneTimeKey)
	}

	static generate(olmAccount) {
		olmAccount.generate_one_time_keys(1)
		const oneTimeKeys = JSON.parse(olmAccount.one_time_keys())
		olmAccount.mark_keys_as_published()

		const oneTimeKey = onlyObjectValue(oneTimeKeys.curve25519)

		return new OlmOneTimeKey(oneTimeKey)
	}

	get oneTimeKeyBase64() {
		return toUnpaddedBase64(this.oneTimeKey)
	}

	encodeCBOR(encoder) {
		const { oneTimeKey } = this
		const tagged = new Tagged(OlmOneTimeKey.CBOR_TAG, toBuffer(oneTimeKey))
		encoder.pushAny(tagged)
	}

	static decodeCBOR(oneTimeKey) {
		return new OlmOneTimeKey(oneTimeKey)
	}
}
