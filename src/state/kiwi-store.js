import ow from 'ow'

import AccountStore from './account-store'
import BufferStore from './buffer-store'
import MegolmInboundSessionStore from './megolm-inbound-session-store'
import MegolmOutboundSessionStore from './megolm-outbound-session-store'
import MegolmSyncedUsersStore from './megolm-synced-users-store'
import OlmSessionStore from './olm-session-store'
import PeerIdentityStore from './peer-identity-store'
import Store from './store'

export default class KiwiOlmStore extends Store {
	constructor(kiwi, networkName, frameworkClient) {
		ow(frameworkClient, 'frameworkClient', ow.object)
		super(kiwi, networkName)

		this.accounts = new AccountStore(kiwi, networkName)
		this.buffers = new BufferStore(kiwi, networkName)
		this.peerIdentities = new PeerIdentityStore(kiwi, networkName)
		this.olmSessions = new OlmSessionStore(kiwi, networkName)
		this.outboundMegolmSessions = new MegolmOutboundSessionStore(
			kiwi,
			networkName,
			frameworkClient,
		)
		this.inboundMegolmSessions = new MegolmInboundSessionStore(kiwi, networkName)
	}

	createMegolmSyncedUsersStore(channelName) {
		return new Set()
		// TODO: fix session bug and re-enable
		return new MegolmSyncedUsersStore(this.kiwi, this.networkName, channelName)
	}
}
