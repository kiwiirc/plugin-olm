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
