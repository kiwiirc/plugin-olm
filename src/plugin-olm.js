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
				<span>{{ currentNetworkName }} {{ currentBufferName }}: {{ syncedCount }}/{{ totalCount }}</span>
			</div>
		`,
		data: () => ({
			networks: {},
		}),
		computed: {
			currentNetworkName,
			currentBufferName,
			currentNetworkSettingsPrefix,
			currentNetwork() {
				if (!this.currentNetworkName) {
					return undefined
				}
				this.ensureNetworkRecordExists(this.currentNetworkName)
				return this.networks[this.currentNetworkName]
			},
			currentBuffer() {
				if (!this.currentBufferName) {
					return undefined
				}
				this.ensureBufferRecordExists(this.currentNetworkName, this.currentBufferName)
				return this.currentNetwork.buffers[this.currentBufferName]
			},
			syncedCount() {
				if (!this.currentBuffer) return 0
				return this.currentBuffer.syncedCount
			},
			totalCount() {
				if (!this.currentBuffer) return 0
				return this.currentBuffer.totalCount
			},
		},
		methods: {
			toggleEncryption,
			encryptionEnabled,
			ensureNetworkRecordExists(networkName) {
				if (!Object.keys(this.networks).includes(networkName)) {
					this.$set(this.networks, networkName, { buffers: {} })
				}
			},
			ensureBufferRecordExists(networkName, bufferName) {
				this.ensureNetworkRecordExists(networkName)

				if (!Object.keys(this.networks[networkName].buffers).includes(bufferName)) {
					this.$set(this.networks[networkName].buffers, bufferName, {
						syncedCount: 0,
						totalCount: 0,
					})
				}
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

		ircClient.on('olm.message', ({ sender, /* target, */ text }) => {
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

		ircClient.on(
			'megolm.sync.status',
			({ networkName, channelName, syncedCount, totalCount }) => {
				inputBarUI.ensureBufferRecordExists(networkName, channelName)
				const bufferRecord = inputBarUI.networks[networkName].buffers[channelName]
				Object.assign(bufferRecord, {
					syncedCount,
					totalCount,
				})
			},
		)
	}

	client.on('pre.input.command.msg', event => {
		// don't intercept /msg when typed literally
		if (event.raw.startsWith('/')) return

		// check if encryption is enabled for current buffer
		if (!encryptionEnabled()) return

		event.handled = true

		handleInputAsync(event)
	})

	// workaround kiwi rendering sent plaintext messages twice due to echo-message
	client.on('irc.message', (event, network, ircEventObj) => {
		if (event.type === 'privmsg' && event.nick === network.nick) {
			ircEventObj.handled = true
		}
	})

	async function handleInputAsync(event) {
		const buffer = client.state.getActiveBuffer()
		const target = buffer.name
		const net = client.state.getActiveNetwork()

		await net.ircClient.olm.sendMessage(target, event.raw)

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
	const activeNetwork = kiwi.state.getActiveNetwork()
	if (!activeNetwork) {
		return undefined
	}
	return activeNetwork.name
}

function currentBufferName() {
	const activeBuffer = kiwi.state.getActiveBuffer()
	if (!activeBuffer) {
		return undefined
	}
	return activeBuffer.name
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
