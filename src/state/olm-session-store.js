import Olm from 'olm'
import ow from 'ow'

import Store from './store'

export default class OlmSessionStore extends Store {
	get(senderKeyBase64) {
		ow(senderKeyBase64, 'senderKeyBase64', ow.string.nonEmpty)

		const pickledSession = this.getPickledSession(senderKeyBase64)
		if (pickledSession) {
			console.debug(`OlmSessionStore.get: unpickled olm session: ${senderKeyBase64}`)
			return pickledSession
		}

		console.debug(`OlmSessionStore.get: no olm session found: ${senderKeyBase64}`)
	}

	getPickledSession(senderKeyBase64) {
		ow(senderKeyBase64, 'senderKeyBase64', ow.string.nonEmpty)

		const pickledSession = this.networkScopedSetting(['sessions', senderKeyBase64])

		if (!pickledSession) return

		const session = new Olm.Session()
		session.unpickle(this.pickleKey(), pickledSession)
		return session
	}

	set(senderKeyBase64, session) {
		ow(senderKeyBase64, 'senderKeyBase64', ow.string.nonEmpty)
		ow(session, 'session', ow.object.instanceOf(Olm.Session))

		const pickledSession = session.pickle(this.pickleKey())
		this.networkScopedSetting(['sessions', senderKeyBase64], pickledSession)

		console.debug(`OlmSessionStore.set: saved: ${senderKeyBase64}`)
	}
}
