import { Tagged } from 'cbor'

import CBOR from '../constants'
import { toByteArray, toUnpaddedBase64, toBuffer } from '../../utils'
import { mapValues } from 'lodash'

export default class MegolmPacket {
	static CBOR_TAG = CBOR.MEGOLM_PACKET
	ciphertext
	senderKey
	sessionID
	signature

	constructor({ ciphertext, senderKey, sessionID, signature }) {
		this.ciphertext = toByteArray(ciphertext)
		this.senderKey = toByteArray(senderKey)
		this.sessionID = toByteArray(sessionID)
		this.signature = toByteArray(signature)
	}

	decrypt(megolmContext) {
		const {
			base64Pojo: { sessionID, ciphertext },
		} = this
		const { inboundSessions } = megolmContext
		const session = inboundSessions.get(sessionID)
		if (!session) {
			throw new Error('Cannot decrypt message: unknown session')
		}
		const decrypted = session.decrypt(ciphertext, true)
		return decrypted
	}

	get base64Pojo() {
		const { ciphertext, senderKey, sessionID, signature } = this
		const pojo = { ciphertext, senderKey, sessionID, signature }
		const b64ed = mapValues(pojo, toUnpaddedBase64)
		return b64ed
	}

	encodeCBOR(encoder) {
		const { ciphertext, senderKey, sessionID, signature } = this
		const tagged = new Tagged(
			MegolmPacket.CBOR_TAG,
			[ciphertext, senderKey, sessionID, signature].map(toBuffer),
		)
		return encoder.pushAny(tagged)
	}

	static decodeCBOR([ciphertext, senderKey, sessionID, signature]) {
		return new MegolmPacket({ ciphertext, senderKey, sessionID, signature })
	}
}
