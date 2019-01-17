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
