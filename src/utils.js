import voca from 'voca'

export function awaitMessage(ircClient, matcher) {
	return new Promise(resolve => {
		const { connection } = ircClient

		const callback = message => {
			if (matcher(message)) {
				connection.removeListener('message', callback)
				resolve(message)
			}
		}

		connection.on('message', callback)
	})
}

export function getOtherUsers(channel, client) {
	const { users } = channel
	const otherUsers = users.filter(user => user.nick !== client.user.nick)
	return otherUsers
}

// returns the only value in an  array, or throws
export function onlyArrayValue(array) {
	if (!Array.isArray(array)) {
		throw new TypeError('Argument must be an array')
	}

	let value
	let count = 0

	for (const v of Array.prototype.values.call(array)) {
		value = v
		count += 1
	}

	if (count !== 1) {
		throw new TypeError(`Argument must have exactly one entry but had ${count}`)
	}

	return value
}

// returns the only value in an object, or throws
export function onlyObjectValue(object) {
	if (typeof object !== 'object' || object === null) {
		throw new TypeError('Argument must be an object')
	}

	const keys = Object.keys(object)
	if (keys.length !== 1) {
		throw new TypeError('Object must have exactly one entry')
	}

	return object[keys[0]]
}

export function reduceIterable(iterable, reducer, initial) {
	let accumulator = initial
	for (const next of iterable) {
		accumulator = reducer(accumulator, next)
	}
	return accumulator
}

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
