import Store from './store'

export default class MegolmSyncedUsersStore extends Store {
	constructor(kiwi, networkName, channelName) {
		super(kiwi, networkName)

		this.channelName = channelName
	}

	add(nick) {
		this.networkScopedSetting(['channels', this.channelName, 'syncedUsers'], [...this, nick])
	}

	has(nick) {
		return [...this].includes(nick)
	}

	delete(nick) {
		const without = [...this].filter(x => x !== nick)
		this.networkScopedSetting(['channels', this.channelName, 'syncedUsers'], without)
	}

	values() {
		return this.networkScopedSetting(['channels', this.channelName, 'syncedUsers']) || []
	}

	[Symbol.iterator]() {
		return this.values()[Symbol.iterator]()
	}
}
