import ow from 'ow'

export class NoActiveNetworkError extends Error {}

export default class Store {
	constructor(kiwi, networkName) {
		ow(kiwi, 'kiwi', ow.object)
		ow(networkName, 'networkName', ow.string.nonEmpty)

		this.kiwi = kiwi
		this.networkName = networkName
	}

	networkScopedSetting(partialKey, value) {
		ow(
			partialKey,
			'partialKey',
			ow.any(ow.string.nonEmpty, ow.array.ofType(ow.string.nonEmpty)),
		)

		const keyPart = partialKey instanceof Array ? partialKey : [partialKey]

		return this.kiwi.state.setting(
			['plugin-olm', 'networks', this.networkName, ...keyPart].join('.'),
			value,
		)
	}

	pickleKey() {
		return 'pickle key' // TODO: optionally protect with a master password?
	}
}
