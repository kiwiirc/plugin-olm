const NULL_CHAR = 0x00 // null byte
const LF_CHAR = 0x0a // line feed
const CR_CHAR = 0x0d // carriage return
const EQ_CHAR = 0x3d // equal sign: =

const BASE_OFFSET = 42 // applied to all bytes
const ESCAPE_OFFSET = 64 // additional offset applied to reserved characters

const UINT8_BOUNDARY = Math.pow(2, 8)

function positiveModulo(dividend, divisor) {
	const remainder = dividend % divisor
	if (remainder < 0) {
		return remainder + divisor
	}
	return remainder
}

// http://www.yenc.org/yenc-draft.1.3.txt
// this is only the core encoding from yEnc. no headers, checksum, or line wrapping.
export default class YEnc {
	static reserved = [NULL_CHAR, LF_CHAR, CR_CHAR, EQ_CHAR]

	static encode(bytes /*: Uint8Array|Buffer */) /*: Uint8Array */ {
		const yEncodedTypedArray = new Uint8Array(YEnc.encoder(bytes))
		return yEncodedTypedArray
	}

	static decode(yEncodedTypedArray) /*: Uint8Array */ {
		const byteArray = new Uint8Array(YEnc.decoder(yEncodedTypedArray))
		return byteArray
	}

	static *encoder(bytes) {
		for (const byte of bytes) {
			const offsetByte = (byte + BASE_OFFSET) % UINT8_BOUNDARY

			if (YEnc.reserved.includes(offsetByte)) {
				yield EQ_CHAR
				yield (offsetByte + ESCAPE_OFFSET) % UINT8_BOUNDARY
			} else {
				yield offsetByte
			}
		}
	}

	static *decoder(bytes) {
		let escape = false
		for (const offsetByte of bytes) {
			if (escape) {
				// previous byte started the escape sequence
				escape = false
				yield positiveModulo(offsetByte - ESCAPE_OFFSET - BASE_OFFSET, UINT8_BOUNDARY)
				continue
			}

			if (offsetByte === EQ_CHAR) {
				// this byte is starting an escape sequence
				escape = true
				continue
			}

			// typically encoded byte
			yield positiveModulo(offsetByte - BASE_OFFSET, UINT8_BOUNDARY)
		}
	}
}
