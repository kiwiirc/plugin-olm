export function partitionObject(obj, predicate) {
	const pass = {}
	const fail = {}
	for (const [key, value] of Object.entries(obj)) {
		if (predicate(key, value, obj)) {
			pass[key] = value
		} else {
			fail[key] = value
		}
	}
	return [pass, fail]
}
