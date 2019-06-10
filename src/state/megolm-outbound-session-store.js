import ow from 'ow'

import OutboundGroupSession from '../outbound-group-session'
import Store from './store'

export default class MegolmOutboundSessionStore extends Store {
	constructor(kiwi, networkName, frameworkClient) {
		ow(frameworkClient, 'frameworkClient', ow.object) // TODO instanceOf
		super(kiwi, networkName)

		this.frameworkClient = frameworkClient
		this.liveSessions = new Map() // channelName -> OutboundGroupSession
	}

	get(channelName) {
		ow(channelName, 'channelName', ow.string.nonEmpty)

		if (this.liveSessions.has(channelName)) {
			console.debug(`found live outbound megolm session ${this.networkName} ${channelName}`)

			return this.liveSessions.get(channelName)
		}

		return this.loadPickled(channelName)
	}

	loadPickled(channelName) {
		ow(channelName, 'channelName', ow.string.nonEmpty)

		const pickled = this.networkScopedSetting(['sessions', 'megolm', 'outbound', channelName])
		if (!pickled) return

		const { frameworkClient: client } = this
		const { olmBroker, megolmBroker } = client.olm
		const { shouldInitiateKeyExchange } = megolmBroker

		const liveSession = new OutboundGroupSession({
			client,
			channelName,
			olmBroker,
			shouldInitiateKeyExchange,
		})

		this.liveSessions.set(channelName, liveSession)

		console.debug(`loaded pickled outbound megolm session ${this.networkName} ${channelName}`)

		return liveSession
	}

	set(channelName, session) {
		ow(channelName, 'channelName', ow.string.nonEmpty)
		ow(session, 'session', ow.object.instanceOf(OutboundGroupSession))

		this.liveSessions.set(channelName, session)

		const pickled = session.session.pickle(this.pickleKey())
		this.networkScopedSetting(['sessions', 'megolm', 'outbound', channelName], pickled)

		console.debug(`saved outbound megolm session ${this.networkName} ${channelName}`)
	}
}
