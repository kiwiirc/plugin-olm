import { Decoder } from 'cbor'
import { toBuffer } from '../utils/toBuffer'
import * as types from './types' // eslint-disable-line import/no-namespace

const decoderMap = Object.values(types).reduce(
	(map, type) => ({
		...map,
		[type.CBOR_TAG]: type.decodeCBOR,
	}),
	{},
)

const decoderOptions = {
	tags: decoderMap,
}

export default function cborDecode(data) {
	return Decoder.decodeFirstSync(toBuffer(data), decoderOptions)
}
