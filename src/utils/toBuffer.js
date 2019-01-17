export function toBuffer(data) {
	if (typeof data === 'string') {
		return Buffer.from(data, 'base64')
	}
	const TypedArray = Object.getPrototypeOf(Uint8Array)
	if (data instanceof TypedArray || data instanceof Buffer) {
		return Buffer.from(data)
	}
	throw new TypeError('data must be a base64 encoded string, TypedArray, or Buffer')
}
