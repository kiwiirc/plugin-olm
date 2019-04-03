/* global kiwi */
import Olm from 'olm'
import olmMiddleware from './middleware'
import './styles.css'
import { CAPABILITIES } from './constants'
import { library as fontawesomeLibrary } from '@fortawesome/fontawesome-svg-core'
import { faLock, faLockOpen, faCircleNotch, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

kiwi.on('network.new', newNetworkEvent => {
	const client = newNetworkEvent.network.ircClient
	client.requestCap(CAPABILITIES.MESSAGE_TAGS)
	client.requestCap('echo-message')
	client.requestCap('draft/labeled-response')
})

kiwi.plugin('olm', async (client /* , log */) => {
	if (typeof Olm.init === 'function') {
		await Olm.init()
	}

	const { Vue } = kiwi

	fontawesomeLibrary.add(faLock, faLockOpen, faCircleNotch, faSync)
	Vue.component('font-awesome-icon', FontAwesomeIcon)

	const InputBarUI = Vue.extend({
		template: `
			<div class="plugin-olm-inputbar-ui">
				<font-awesome-icon
					:icon="encryptionEnabled() ? 'lock' : 'lock-open'"
					v-on:click="toggleEncryption()"
				/>
				<transition name="fade" mode="in-out">
					<font-awesome-icon
						class="olm-syncing-icon"
						spin
						icon="sync"
						v-if="syncedCount < totalCount"
					/>
				</transition>
				<span>{{ currentNetworkName }} {{ currentChannelName }}: {{ syncedCount() }}/{{ totalCount() }}</span>
			</div>
		`,
		data: () => ({
			networks: {},
		}),
		computed: {
			currentNetworkName() {
				// this.ui.active_network = networkid;
				// this.ui.active_buffer = bufferName;

				// return kiwi.state.networks.find(
				// 	network => network.id === kiwi.state.ui.active_network,
				// ).name

				return kiwi.state.getActiveNetwork().name
			},
			currentChannelName() {
				const activeBuffer = kiwi.state.getActiveBuffer()
				// const activeBuffer = kiwi.state.networks
				// 	.find(network => network.id === kiwi.state.ui.active_network)
				// 	.buffers.find(buffer => buffer.name === kiwi.state.ui.active_buffer)
				if (activeBuffer.isChannel()) {
					return activeBuffer.name
				}
				return undefined
			},
			currentNetwork() {
				if (this.currentNetworkName === undefined) {
					return
				}
				this.ensureNetworkRecordExists(this.currentNetworkName)
				return this.networks[this.currentNetworkName]
			},
			currentChannel() {
				if (this.currentChannelName === undefined) {
					return
				}
				this.ensureChannelRecordExists(
					this.currentNetworkName,
					this.currentChannelChannelName,
				)
				return this.currentNetwork.channels[this.currentChannelName]
			},
		},
		methods: {
			encryptionEnabled,
			toggleEncryption,
			ensureNetworkRecordExists(networkName) {
				if (!Object.getOwnPropertyNames(this.networks).includes(networkName)) {
					this.networks[networkName] = {
						channels: {},
					}
				}
			},
			ensureChannelRecordExists(networkName, channelName) {
				this.ensureNetworkRecordExists(networkName)

				if (
					!Object.getOwnPropertyNames(this.networks[networkName].channels).includes(
						channelName,
					)
				) {
					this.networks[networkName].channels[channelName] = {
						syncedCount: 0,
						totalCount: 0,
					}
				}
			},
			syncedCount() {
				if (!this.currentChannel) return 0
				return this.currentChannel.syncedCount
			},
			totalCount() {
				if (!this.currentChannel) return 0
				return this.currentChannel.totalCount
			},
		},
	})

	const inputBarUI = new InputBarUI()
	window.inputBarUI = inputBarUI
	inputBarUI.$mount()
	client.addUi('input', inputBarUI.$el)

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

		ircClient.on('olm.message', ({ sender, target, text }) => {
			const buffer = kiwi.state.getOrAddBufferByName(network.id, sender)

			buffer.state.addMessage(buffer, {
				time: Date.now(),
				nick: sender,
				message: text,
				type: 'privmsg',
				type_extra: 'encrypted',
			})
		})

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

		ircClient.on('megolm.sync.status', ({ network, channel, syncedCount, totalCount }) => {
			inputBarUI.ensureChannelRecordExists(network, channel)
			const channelRecord = inputBarUI.networks[network].channels[channel]
			Object.assign(channelRecord, {
				syncedCount,
				totalCount,
			})
			inputBarUI.$forceUpdate()
		})
	}

	client.on('pre.input.command.msg', event => {
		// don't intercept /msg when typed literally
		if (event.raw.startsWith('/')) return

		// check if encryption is enabled for current buffer
		if (!encryptionEnabled()) return

		event.handled = true

		handleInputAsync(event)
	})

	async function handleInputAsync(event) {
		const buffer = client.state.getActiveBuffer()
		const target = buffer.name
		const net = client.state.getActiveNetwork()

		await net.ircClient.olm.sendMessage(target)

		buffer.state.addMessage(buffer, {
			time: Date.now(),
			nick: net.nick,
			message: event.raw,
			type: 'privmsg',
			type_extra: 'encrypted',
		})
	}
})

function currentNetworkName() {
	return kiwi.state.getActiveNetwork().name
}

function currentBufferName() {
	return kiwi.state.getActiveBuffer().name
}

function currentNetworkSettingsPrefix() {
	return `plugin-olm.networks.${currentNetworkName()}`
}

function encryptionEnabledBuffers() {
	return kiwi.state.setting(`${currentNetworkSettingsPrefix()}.enabled_buffers`) || []
}

function encryptionEnabled() {
	return encryptionEnabledBuffers().includes(currentBufferName())
}

function toggleEncryption() {
	if (encryptionEnabled()) {
		disableEncryption()
	} else {
		enableEncryption()
	}
}

function enableEncryption() {
	kiwi.state.setting(`${currentNetworkSettingsPrefix()}.enabled_buffers`, [
		...encryptionEnabledBuffers(),
		currentBufferName(),
	])
}

function disableEncryption() {
	kiwi.state.setting(
		`${currentNetworkSettingsPrefix()}.enabled_buffers`,
		encryptionEnabledBuffers().filter(x => x !== currentBufferName()),
	)
}
