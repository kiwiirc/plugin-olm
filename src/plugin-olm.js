/* global kiwi */
import Olm from 'olm'
import olmMiddleware from './middleware'
import './styles.css'
import { CAPABILITIES } from './constants'

kiwi.on('network.new', newNetworkEvent => {
	const client = newNetworkEvent.network.ircClient
	client.requestCap(CAPABILITIES.MESSAGE_TAGS)
	client.requestCap('echo-message')
	// client.requestCap('draft/labeled-response')
})

kiwi.plugin('olm', async (client /* , log */) => {
	await Olm.init()

	// add button to input bar
	const inputBarUI = document.createElement('span')
	inputBarUI.className = 'plugin-olm-inputbar-ui'

	const icon = document.createElement('i')
	icon.className = 'fa fa-user-secret'
	inputBarUI.appendChild(icon)

	const syncStatus = document.createElement('span')
	syncStatus.className = 'sync-status'
	syncStatus.innerText = '?/?'
	inputBarUI.appendChild(syncStatus)

	client.addUi('input', inputBarUI)

	client.on('network.new', newNetworkEvent => {
		const { network } = newNetworkEvent
		handleNewNetwork(network)
	})

	// the client will sometimes create networks before plugins can load
	for (const network of client.state.networks) {
		handleNewNetwork(network)
	}

	function handleNewNetwork(network) {
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

		ircClient.on('join', event => {
			ircClient.olm.getGroupSession(event.channel)
		})

		ircClient.on('megolm.sync.status', ({ channel, syncedCount, totalCount }) => {
			syncStatus.innerText = `${syncedCount}/${totalCount}`
		})
	}

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
