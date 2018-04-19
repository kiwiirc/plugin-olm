export default function awaitMessage(ircClient, matcher) {
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
