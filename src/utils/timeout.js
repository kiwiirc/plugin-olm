export function timeout(seconds, error) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			reject(error || new Error('Timeout expired'))
		}, seconds * 1000)
	})
}
