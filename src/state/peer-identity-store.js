import ow from 'ow'

import Store from './store'

export default class PeerIdentityStore extends Store {
	get(nick) {
		ow(nick, 'nick', ow.string.nonEmpty)

		return this.networkScopedSetting(['peerIdentities', nick])
	}

	has(nick) {
		ow(nick, 'nick', ow.string.nonEmpty)

		Boolean(this.networkScopedSetting(['peerIdentities', nick]))
	}

	set(nick, peerIdentityKey) {
		ow(nick, 'nick', ow.string.nonEmpty)
		ow(peerIdentityKey, 'peerIdentityKey', ow.string.nonEmpty)

		this.networkScopedSetting(['peerIdentities', nick], peerIdentityKey)
	}

	delete(nick) {
		ow(nick, 'nick', ow.string.nonEmpty)

		this.networkScopedSetting(['peerIdentities', nick], null)
	}
}
