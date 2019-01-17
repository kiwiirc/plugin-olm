import cbor from 'cbor'
import cborDecode from './cbor-decoder'
import { toUnpaddedBase64 } from '../utils/toUnpaddedBase64'

export function serializeToMessageTagValue(object) {
	const encodedBuffer = cbor.encode(object)
	const base64 = toUnpaddedBase64(encodedBuffer)
	return base64
}

export function deserializeFromMessageTagValue(tagValue) {
	const decoded = cborDecode(tagValue)
	return decoded
}
