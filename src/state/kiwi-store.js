import ow from 'ow'

import AccountStore from './account-store'
import Store from './store'
import BufferStore from './buffer-store'
import OlmSessionStore from './olm-session-store'
import PeerIdentityStore from './peer-identity-store'

export default class KiwiOlmStore extends Store {
	constructor(kiwi, networkName) {
		super(kiwi, networkName)

		this.accounts = new AccountStore(kiwi, networkName)
		this.buffers = new BufferStore(kiwi, networkName)
		this.peerIdentities = new PeerIdentityStore(kiwi, networkName)
		this.olmSessions = new OlmSessionStore(kiwi, networkName)
	}
}
