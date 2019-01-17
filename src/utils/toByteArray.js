export function toByteArray(data) {
	if (typeof data === 'string') {
		return Uint8Array.from(Buffer.from(data, 'base64'))
	}
	const TypedArray = Object.getPrototypeOf(Uint8Array)
	if (data instanceof TypedArray || data instanceof Buffer) {
		return Uint8Array.from(data)
	}
	throw new TypeError('data must be a base64 encoded string, TypedArray, or Buffer')
}
