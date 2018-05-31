import CBOR_TAGS from '../constants'
import { Tagged } from 'cbor'
import { toByteArray, toBuffer, toUnpaddedBase64 } from '../../utils'

export default class MegolmSessionState {
	static CBOR_TAG = CBOR_TAGS.MEGOLM_SESSION_STATE
	sessionID
	sessionKey
	messageIndex

	constructor(sessionID, sessionKey, messageIndex) {
		this.sessionID = toByteArray(sessionID)
		this.sessionKey = toByteArray(sessionKey)
		this.messageIndex = messageIndex
	}

	static newFromSession(session) {
		return new MegolmSessionState(
			session.session_id(),
			session.session_key(),
			session.message_index(),
		)
	}

	get sessionIDBase64() {
		return toUnpaddedBase64(this.sessionID)
	}

	get sessionKeyBase64() {
		return toUnpaddedBase64(this.sessionKey)
	}

	encodeCBOR(encoder) {
		const { sessionID, sessionKey, messageIndex } = this
		const tagged = new Tagged(MegolmSessionState.CBOR_TAG, [
			toBuffer(sessionID),
			toBuffer(sessionKey),
			messageIndex,
		])
		return encoder.pushAny(tagged)
	}

	static decodeCBOR([sessionID, sessionKey, messageIndex]) {
		return new MegolmSessionState(sessionID, sessionKey, messageIndex)
	}
}
