import voca from 'voca'
export function toUnpaddedBase64(data) {
	if (typeof data === 'string') {
		const unpadded = voca.trimRight(data, '=')
		return unpadded
	}
	const TypedArray = Object.getPrototypeOf(Uint8Array)
	if (data instanceof TypedArray || data instanceof Buffer) {
		const buf = Buffer.from(data)
		const b64 = buf.toString('base64')
		const unpadded = voca.trimRight(b64, '=')
		return unpadded
	}
	throw new TypeError('data must be a base64 encoded string, TypedArray, or Buffer')
}
