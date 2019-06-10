import ow from 'ow'

import Store from './store'

export default class PersistedOlmTypeStore extends Store {
	constructor(kiwi, networkName, keyName, olmTypeConstructor, settingKey) {
		ow(keyName, 'keyName', ow.string.nonEmpty)
		ow(olmTypeConstructor, 'olmTypeConstructor', ow.function)
		ow(settingKey, 'settingKey', ow.string.nonEmpty)

		super(kiwi, networkName)

		this.keyName = keyName
		this.olmTypeConstructor = olmTypeConstructor
		this.settingKey = settingKey
	}

	get(key) {
		ow(key, this.keyName, ow.string.nonEmpty)

		const pickled = this.networkScopedSetting([this.settingKey, key])

		if (!pickled) return

		const olmValue = new this.olmTypeConstructor()
		olmValue.unpickle(this.pickleKey(), pickled)
		console.debug(`loaded ${this.keyName}: ${pickled}`)

		return olmValue
	}

	set(key, val) {
		ow(key, this.keyName, ow.string.nonEmpty)
		ow(val, 'val', ow.object)

		const pickled = val.pickle(this.pickleKey())
		this.networkScopedSetting([this.settingKey, key], pickled)

		console.debug(`saved ${this.keyName}: ${pickled}`)
	}
}
