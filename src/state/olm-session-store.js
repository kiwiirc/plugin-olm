import Olm from 'olm'
import ow from 'ow'

import { toUnpaddedBase64 } from '../utils/toUnpaddedBase64'
import Store from './store'

export class PacketDecryptionFailedError extends Error {
	constructor(sessionIDtoErrorMap) {
		super()

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor)
		}

		// Custom debugging information
		this.sessionIDtoErrorMap = sessionIDtoErrorMap
	}

	get name() {
		return this.constructor.name
	}

	get message() {
		let msg = 'Failed to decrypt packet:\n'
		for (const [sessionID, err] of this.sessionIDtoErrorMap) {
			msg += `sessionID ${sessionID} => ${err}\n`
		}
		return msg
	}
}

export default class OlmSessionStore extends Store {
	getSessionRecords(senderKey) {
		const sessionRecords = this.networkScopedSetting(['sessions', 'olm', senderKey])
		return sessionRecords || []
	}

	toSessionRecord(session) {
		const sessionID = session.session_id()
		const pickledSession = session.pickle(this.pickleKey())
		const storedAt = Date.now()

		const sessionRecord = {
			sessionID,
			pickledSession,
			storedAt,
		}

		return sessionRecord
	}

	toSession(sessionRecord) {
		const session = new Olm.Session()
		session.unpickle(this.pickleKey(), sessionRecord.pickledSession)
		return session
	}

	addSession(senderKey, session) {
		const sessionRecord = this.toSessionRecord(session)
		const sessionRecords = this.getSessionRecords(senderKey)

		if (sessionRecords.find(sr => sr.sessionID === sessionRecord.sessionID)) {
			throw new Error('Found matching session')
		}

		sessionRecords.unshift(sessionRecord)
		this.networkScopedSetting(['sessions', 'olm', senderKey], sessionRecords)
	}

	updateSession(senderKey, session) {
		const sessionRecord = this.toSessionRecord(session)
		const sessionRecords = this.getSessionRecords(senderKey)

		const idx = sessionRecords.findIndex(sr => sr.sessionID === sessionRecord.sessionID)
		if (idx === -1) {
			throw new Error('Matching session not found')
		}

		// replace old matching record
		sessionRecords[idx] = sessionRecord

		// sort more recently updated records towards beginning of array
		sessionRecords.sort((a, b) => a.storedAt < b.storedAt)

		this.networkScopedSetting(['sessions', 'olm', senderKey], sessionRecords)
	}

	getLatestSession(senderKey) {
		const sessionRecords = this.getSessionRecords(senderKey)
		const latestSessionRecord = sessionRecords[0]

		if (!latestSessionRecord) {
			return undefined
		}

		return this.toSession(latestSessionRecord)
	}

	decryptPacket(packet, olmBroker) {
		const { senderKeyBase64, encryptionResult } = packet
		const { body, type } = encryptionResult
		const sessionRecords = this.getSessionRecords(senderKeyBase64)

		// try to decrypt with saved sessions
		const errs = new Map()
		for (const sessionRecord of sessionRecords) {
			const session = this.toSession(sessionRecord)
			try {
				const decryptedBytes = session.decrypt(type, toUnpaddedBase64(body), Uint8Array)
				this.updateSession(senderKeyBase64, session)
				return decryptedBytes
			} catch (err) {
				const sessionID = session.session_id()
				errs.set(sessionID, err)
			}
		}

		// try to create session from prekey packet

		if (type !== 0) {
			// message is part of a pre-existing session that we're missing
			// TODO: renegoatate session when error occurs
			if (errs.size > 0) {
				throw new PacketDecryptionFailedError(errs)
			}
			throw new Error('Cannot decrypt message: unknown session continuation')
		}

		const newSession = packet.createInboundSession(olmBroker)
		this.addSession(senderKeyBase64, newSession)
		console.debug('Created new inbound olm session from packet', {
			senderKeyBase64,
			newSession,
		})

		try {
			const decryptedBytes = newSession.decrypt(type, toUnpaddedBase64(body), Uint8Array)
			this.updateSession(senderKeyBase64, newSession)
			return decryptedBytes
		} catch (err) {
			const sessionID = newSession.session_id()
			errs.set(sessionID, err)
			// console.warn('Failed to decrypt packet', { packet, sessionID, err })
			throw new PacketDecryptionFailedError(errs)
		}
	}
}
