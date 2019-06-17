import ow from 'ow'

import Store from './store'

export class NoSuchNetworkError extends Error {
	constructor(networkName) {
		ow(networkName, 'networkName', ow.string.nonEmpty)

		super()
		this.message = `No such network ${JSON.stringify(networkName)}`
	}
}

export default class BufferStore extends Store {
	async toggleEncryption(bufferName) {
		ow(bufferName, 'bufferName', ow.string.nonEmpty)

		if (this.isEncryptionEnabled(bufferName)) {
			this.disableEncryption(bufferName)
		} else {
			await this.enableEncryption(bufferName)
		}
	}

	isEncryptionEnabled(bufferName) {
		ow(bufferName, 'bufferName', ow.string.nonEmpty)

		const enabledBuffers = this.encryptionEnabledBuffers()
		const enabled = enabledBuffers.includes(bufferName)
		return enabled
	}

	async enableEncryption(bufferName) {
		ow(bufferName, 'bufferName', ow.string.nonEmpty)

		this.setEncryption(true, bufferName)

		if (this.getNetwork().isChannelName(bufferName)) {
			await this.initGroupSession(bufferName)
		}
	}

	disableEncryption(bufferName) {
		ow(bufferName, 'bufferName', ow.string.nonEmpty)

		this.setEncryption(false, bufferName)
	}

	setEncryption(enabled, bufferName) {
		ow(enabled, 'enabled', ow.boolean)
		ow(bufferName, 'bufferName', ow.string.nonEmpty)

		const enabledBuffers = enabled
			? [...this.encryptionEnabledBuffers(), bufferName]
			: this.encryptionEnabledBuffers().filter(x => x !== bufferName)

		this.networkScopedSetting('enabled_buffers', enabledBuffers)
	}

	encryptionEnabledBuffers() {
		return this.networkScopedSetting('enabled_buffers') || []
	}

	async initGroupSession(bufferName) {
		ow(bufferName, 'bufferName', ow.string.nonEmpty)

		const net = this.getNetwork()
		const groupSession = await net.ircClient.olm.getGroupSession(bufferName)
		groupSession.shareState()
	}

	getNetwork() {
		const net = this.kiwi.state.networks.find(net => net.name === this.networkName)
		if (!net) {
			throw new NoSuchNetworkError(this.networkName)
		}
		return net
	}
}
