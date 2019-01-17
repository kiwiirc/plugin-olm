export function shorten(str) {
	return `${str.slice(0, 8)}...${str.slice(-8)}`
}
