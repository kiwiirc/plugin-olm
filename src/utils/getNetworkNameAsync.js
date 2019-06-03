export default function getNetworkNameAsync(ircfwClient) {
	// network name available synchronously
	if (ircfwClient.network.name !== 'Network') {
		return ircfwClient.network.name
	}

	// wait for RPL_ISUPPORT
	return new Promise(resolve => {
		const serverOptionsHandler = ({ options }) => {
			if (!Object.keys(options).includes('NETWORK')) {
				return
			}
			const networkName = options.NETWORK
			ircfwClient.removeListener('server options', serverOptionsHandler)
			resolve(networkName)
		}
		ircfwClient.on('server options', serverOptionsHandler)
	})
}
