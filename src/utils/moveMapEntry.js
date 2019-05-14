export default function moveMapEntry(map, oldKey, newKey) {
	if (!map.has(oldKey)) {
		throw new Error(`oldKey ${JSON.stringify(oldKey)} not found in map`)
	}
	if (map.has(newKey)) {
		throw new Error(`newKey ${JSON.stringify(newKey)} already present in map`)
	}

	const val = map.get(oldKey)
	map.delete(oldKey)
	map.set(newKey, val)
}
