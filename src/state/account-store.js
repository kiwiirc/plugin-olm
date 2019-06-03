import Olm from 'olm'
import ow from 'ow'

import Store from './store'

export default class AccountStore extends Store {
	loadOrCreateAccount() {
		if (this.hasPickledAccount()) {
			return this.loadPickledAccount()
		}
		return this.createAccount()
	}

	loadPickledAccount() {
		const pickledAccount = this.getPickledAccount(this.networkName)
		const account = new Olm.Account()
		account.unpickle(this.pickleKey(), pickledAccount)
		console.debug(
			`AccountStore: loaded pickled Olm.Account for network ${JSON.stringify(
				this.networkName,
			)}`,
		)
		return account
	}

	createAccount() {
		const account = new Olm.Account()
		account.create()
		this.persistAccount(account)
		console.debug(
			`AccountStore: created new Olm.Account for network ${JSON.stringify(this.networkName)}`,
		)
		return account
	}

	hasPickledAccount() {
		return Boolean(this.getPickledAccount(this.networkName))
	}

	getPickledAccount() {
		return this.networkScopedSetting('account')
	}

	persistAccount(account) {
		ow(account, 'account', ow.object.instanceOf(Olm.Account))

		this.networkScopedSetting('account', account.pickle(this.pickleKey()))
		console.debug(
			`AccountStore: persisted Olm.Account for network ${JSON.stringify(this.networkName)}`,
		)
	}
}

/*
export default class AccountStore extends Store {
	loadOrCreateAccount(networkName) {
		ow(networkName, 'networkName', ow.string.nonEmpty)

		if (this.hasPickledAccount(networkName)) {
			return this.loadPickledAccount(networkName)
		}
		return this.createAccount(networkName)
	}

	loadPickledAccount(networkName) {
		ow(networkName, 'networkName', ow.string.nonEmpty)

		const pickledAccount = this.getPickledAccount(networkName)
		const account = new Olm.Account()
		account.unpickle(this.pickleKey(), pickledAccount)
		console.debug(
			`plugin-olm: loaded pickled Olm.Account for network ${JSON.stringify(networkName)}`,
		)
		return account
	}

	createAccount(networkName) {
		ow(networkName, 'networkName', ow.string.nonEmpty)

		const account = new Olm.Account()
		account.create()
		this.persistAccount(networkName, account)
		console.debug(
			`plugin-olm: created new Olm.Account for network ${JSON.stringify(networkName)}`,
		)
		return account
	}

	hasPickledAccount(networkName) {
		ow(networkName, 'networkName', ow.string.nonEmpty)

		return Boolean(this.getPickledAccount(networkName))
	}

	getPickledAccount(networkName) {
		ow(networkName, 'networkName', ow.string.nonEmpty)

		return this.networkScopedSetting(networkName, 'account')
	}

	persistAccount(networkName, account) {
		ow(networkName, 'networkName', ow.string.nonEmpty)
		ow(account, 'account', ow.object.instanceOf(Olm.Account))

		this.networkScopedSetting(networkName, 'account', account.pickle(this.pickleKey()))
		console.debug(
			`plugin-olm: persisted Olm.Account for network ${JSON.stringify(networkName)}`,
		)
	}
}
*/
