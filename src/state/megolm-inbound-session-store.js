import Olm from 'olm'

import PersistedOlmTypeStore from './persisted-olm-type-store'

export default class MegolmInboundSessionStore extends PersistedOlmTypeStore {
	constructor(kiwi, networkName) {
		super(kiwi, networkName, 'sessionID', Olm.InboundGroupSession, 'megolm-session-inbound')
	}
}
