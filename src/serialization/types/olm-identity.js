import { Tagged } from 'cbor'
import { toByteArray, toUnpaddedBase64, toBuffer } from '../../utils'
import CBOR_TAGS from '../constants'

export default class OlmIdentity {
	static CBOR_TAG = CBOR_TAGS.OLM_IDENTITY
	curve25519IdentityKey

	constructor(curve25519IdentityKey) {
		this.curve25519IdentityKey = toByteArray(curve25519IdentityKey)
	}

	get curve25519IdentityKeyBase64() {
		return toUnpaddedBase64(this.curve25519IdentityKey)
	}

	encodeCBOR(encoder) {
		const { curve25519IdentityKey } = this
		const tagged = new Tagged(OlmIdentity.CBOR_TAG, toBuffer(curve25519IdentityKey))
		encoder.pushAny(tagged)
	}

	static decodeCBOR(curve25519IdentityKey) {
		return new OlmIdentity(curve25519IdentityKey)
	}
}
