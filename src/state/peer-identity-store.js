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

		const existingIdentity = this.get(nick)
		if (existingIdentity && existingIdentity !== peerIdentityKey) {
			console.warn(
				`Overwriting stored peerIdentityKey for ${nick}: ${existingIdentity} => ${peerIdentityKey}`,
			)
		}

		this.networkScopedSetting(['peerIdentities', nick], peerIdentityKey)

		console.debug(`PeerIdentityStore.set: ${nick} => ${peerIdentityKey}`)
	}

	delete(nick) {
		ow(nick, 'nick', ow.string.nonEmpty)

		this.networkScopedSetting(['peerIdentities', nick], null)
	}
}
