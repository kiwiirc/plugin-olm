export function reduceIterable(iterable, reducer, initial) {
	let accumulator = initial
	for (const next of iterable) {
		accumulator = reducer(accumulator, next)
	}
	return accumulator
}
