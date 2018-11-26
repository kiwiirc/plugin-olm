/* global kiwi */

import olmMiddleware from './middleware'
import './styles.css'

kiwi.plugin('olm', (client /* , log */) => {
	// add button to input bar
	const e2eToggleButton = document.createElement('i')
	e2eToggleButton.className = 'e2e-toggle-button fa fa-user-secret'
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
				message: text,
				type: 'privmsg',
				type_extra: 'encrypted',
			})
		})

		ircClient.on('megolm.packet.error', ({ sender, target, error }) => {
			const buffer = network.bufferByName(target)

			buffer.state.addMessage(buffer, {
				time: Date.now(),
				nick: sender,
				message: String(error),
				type: 'privmsg',
				type_extra: 'decryption-error',
			})
		})
	})

	client.on('input.command.msg', event => {
		const plaintext = event.raw
		if (plaintext.startsWith('/')) return // don't intercept /msg as command

		event.handled = true

		const buffer = client.state.getActiveBuffer()
		const target = buffer.name
		const net = client.state.getActiveNetwork()

		net.ircClient.olm.sendMessage(target, plaintext)

		buffer.state.addMessage(buffer, {
			time: Date.now(),
			nick: net.nick,
			message: plaintext,
			type: 'privmsg',
			type_extra: 'encrypted',
		})
	})
})
