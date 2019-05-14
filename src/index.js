/* global kiwi */
import './styles.css'

import { library as fontawesomeLibrary } from '@fortawesome/fontawesome-svg-core'
import { faCircleNotch, faLock, faLockOpen, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import Olm from 'olm'

import { CAPABILITIES } from './constants'
import olmMiddleware from './middleware'

kiwi.on('network.new', newNetworkEvent => {
	const { ircClient: client } = newNetworkEvent.network
	const wantedCaps = [
		[CAPABILITIES.MESSAGE_TAGS, CAPABILITIES.DRAFT_MESSAGE_TAGS_0_2],
		CAPABILITIES.ECHO_MESSAGE,
		[CAPABILITIES.LABELED_RESPONSE, CAPABILITIES.DRAFT_LABELED_RESPONSE],
	]
	for (const wantedCap of wantedCaps.flat()) {
		client.requestCap(wantedCap)
	}

	client.on('registered', event => {
		const missingCaps = []
		const { /* requested, */ enabled } = client.network.cap
		for (const wantedCap of wantedCaps) {
			if (wantedCap instanceof Array) {
				if (!wantedCap.some(versionedCap => enabled.includes(versionedCap))) {
					missingCaps.push(wantedCap)
				}
			} else if (!enabled.includes(wantedCap)) {
				missingCaps.push(wantedCap)
			}
		}
		if (missingCaps.length > 0) {
			kiwi.state.addMessage(newNetworkEvent.network.serverBuffer(), {
				time: Date.now(),
				nick: '*',
				message: `Missing some capabilities required for plugin-olm: ${JSON.stringify(
					missingCaps,
				)}`,
				type: 'error',
			})
		}
	})
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
			<div class="plugin-olm-inputbar-ui" @mouseover="hover = true" @mouseleave="hover = false">
				<!-- <v-popover :show="true" :boundariesElement="boundariesElement" placement="bottom-end"> -->
					<font-awesome-icon
						:icon="encryptionEnabled() ? 'lock' : 'lock-open'"
						v-on:click="toggleEncryption()"
					/>
					<div v-if="hover" class="e2ee-sync-status-popover">
						<div>{{ megolmSession.channel }}</div>
						<details>
							<summary>Synced peers ({{ syncedPeers.length }})</summary>
							<ul>
								<li v-for="syncedPeer of syncedPeers">{{ syncedPeer }}</li>
							</ul>
						</details>

						<details open>
							<summary>Unsynced peers ({{ unsyncedPeers.length }})</summary>
							<ul>
								<li v-for="unsyncedPeer of unsyncedPeers">{{ unsyncedPeer }}</li>
							</ul>
						</details>
					</div>
				<!-- </v-popover> -->
				<transition name="fade" mode="in-out">
					<font-awesome-icon
						class="olm-syncing-icon"
						spin
						icon="sync"
						v-if="unsyncedPeers.length > 0"
					/>
				</transition>
			</div>
		`,
		data: () => ({
			networks: {},
			hover: false,
		}),
		computed: {
			currentNetworkState,
			currentNetworkName,
			currentKiwiBuffer,
			currentBufferName,
			networkSettingsPrefix,
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
			syncedPeers() {
				if (!this.currentBuffer) return []
				return this.currentBuffer.syncedPeers
			},
			unsyncedPeers() {
				if (!this.currentBuffer) return []
				return this.currentBuffer.unsyncedPeers
			},
			async megolmSession() {
				const networkState = this.currentNetworkState
				if (!networkState || !this.currentKiwiBuffer.isChannel()) {
					return undefined
				}
				if (!networkState.ircClient.olm) return
				const { megolmBroker } = networkState.ircClient.olm
				if (!megolmBroker) return
				return await megolmBroker.getGroupSession(this.currentBufferName)
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
						syncedPeers: [],
						unsyncedPeers: [],
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
		ircClient.use(olmMiddleware({ shouldInitiateKeyExchange }))

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
			({ networkName, channelName, syncedPeers, unsyncedPeers }) => {
				inputBarUI.ensureBufferRecordExists(networkName, channelName)
				const bufferRecords = inputBarUI.networks[networkName].buffers
				bufferRecords[channelName] = {
					...bufferRecords[channelName],
					syncedPeers: [...syncedPeers],
					unsyncedPeers: [...unsyncedPeers],
				}
			},
		)

		ircClient.on('nick', ({ nick, ident, hostname, new_nick, time }) => {
			if (nick === ircClient.user.nick) return // ignore self
			const networkName = ircClient.network.name
			const enabled = encryptionEnabled(networkName, nick)
			setEncryption(enabled, networkName, new_nick)
		})
	}

	client.on('input.command.msg', event => {
		// don't intercept /msg when typed literally
		if (event.raw.startsWith('/')) return

		// check if encryption is enabled for current buffer
		if (!encryptionEnabled()) return

		event.handled = true

		handleInputAsync(event)
	})

	// workaround kiwi rendering sent plaintext messages twice due to echo-message
	client.on('irc.message', (event, network, ircEventObj) => {
		if (event.nick === network.nick) {
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

function currentNetworkState() {
	return kiwi.state.getActiveNetwork()
}

function currentNetworkName() {
	const activeNetwork = currentNetworkState()
	return activeNetwork && activeNetwork.name
}

function currentKiwiBuffer() {
	return kiwi.state.getActiveBuffer()
}

function currentBufferName() {
	const activeBuffer = currentKiwiBuffer()
	return activeBuffer && activeBuffer.name
}

function networkSettingsPrefix(networkName = currentNetworkName()) {
	return `plugin-olm.networks.${networkName}`
}

function encryptionEnabledBuffers(networkName = currentNetworkName()) {
	const prefix = networkSettingsPrefix(networkName)
	return kiwi.state.setting(`${prefix}.enabled_buffers`) || []
}

function encryptionEnabled(networkName = currentNetworkName(), bufferName = currentBufferName()) {
	const enabledBuffers = encryptionEnabledBuffers(networkName)
	const enabled = enabledBuffers.includes(bufferName)
	return enabled
}

function toggleEncryption(networkName = currentNetworkName(), bufferName = currentBufferName()) {
	if (encryptionEnabled(networkName, bufferName)) {
		disableEncryption(networkName, bufferName)
	} else {
		enableEncryption(networkName, bufferName)
	}
}

function setEncryption(
	enabled,
	networkName = currentNetworkName(),
	bufferName = currentBufferName(),
) {
	const prefix = networkSettingsPrefix(networkName)
	let enabledBuffers
	if (enabled) {
		// add to set
		enabledBuffers = [...encryptionEnabledBuffers(networkName), bufferName]
	} else {
		// remove from set
		enabledBuffers = encryptionEnabledBuffers(networkName).filter(x => x !== bufferName)
	}
	kiwi.state.setting(`${prefix}.enabled_buffers`, enabledBuffers)
}

async function enableEncryption(
	networkName = currentNetworkName(),
	bufferName = currentBufferName(),
) {
	setEncryption(true, networkName, bufferName)
	const net = currentNetworkState()
	const groupSession = await net.ircClient.olm.getGroupSession(bufferName)
	groupSession.shareState()
}

function disableEncryption(networkName = currentNetworkName(), bufferName = currentBufferName()) {
	setEncryption(false, networkName, bufferName)
}

function shouldInitiateKeyExchange(outboundGroupSession) {
	const { channelName, client } = outboundGroupSession
	const networkName = client.network.name
	const should = encryptionEnabled(networkName, channelName)
	return should
}
