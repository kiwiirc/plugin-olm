/* global kiwi */

import olmMiddleware from './middleware'

kiwi.plugin('olm', (client /* , log */) => {
	// add button to input bar
	const e2eToggleButton = document.createElement('i')
	e2eToggleButton.className = 'e2e-toggle-button fa fa-exclamation-triangle'
	client.addUi('input', e2eToggleButton)

	client.on('network.new', newNetworkEvent => {
		const { network } = newNetworkEvent
		const { ircClient } = network
		ircClient.use(olmMiddleware())

		ircClient.on('megolm.message', ({ sender, target, text }) => {
			const buffer = network.bufferByName(target)

			buffer.state.addMessage(buffer, {
				time: Date.now(),
				nick: sender,
				message: `ENCRYPTED: ${text}`,
				type: 'privmsg',
			})
		})
	})

	client.on('input.command.e2e', event => {
		event.handled = true
		const plaintext = event.params
		const buffer = client.state.getActiveBuffer()
		const target = buffer.name
		const net = client.state.getActiveNetwork()

		net.ircClient.olm.sendMessage(target, plaintext)
	})
})
