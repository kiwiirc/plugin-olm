export default class NoNullsEncoding {
	static *encoder(bytes) {
		for (const byte of bytes) {
			if (byte <= 0x01) {
				// escaped byte
				yield 0x01
				yield byte + 1
				continue
			}

			// normal byte
			yield byte
		}
	}

	static encode(bytes) {
		return Uint8Array.from(NoNullsEncoding.encoder(bytes))
	}

	static *decoder(bytes) {
		let escaped = false
		for (const byte of bytes) {
			// second byte of escape sequence
			if (escaped) {
				yield byte - 1
				escaped = false
				continue
			}

			// first byte of escape sequence
			if (byte === 0x01) {
				escaped = true
				continue
			}

			// normal byte
			yield byte
		}
	}

	static decode(bytes) {
		return Uint8Array.from(NoNullsEncoding.decoder(bytes))
	}
}
