import cbor, { Tagged } from 'cbor'
import Olm from 'olm'

import { toUnpaddedBase64 } from '../../utils/toUnpaddedBase64'
import { toBuffer } from '../../utils/toBuffer'
import { toByteArray } from '../../utils/toByteArray'
import CBOR from '../constants'
import cborDecode from '../cbor-decoder'

// OlmPacket encapsulates an encrypted payload for a 1:1 Olm session.
export default class OlmPacket {
	static CBOR_TAG = CBOR.OLM_PACKET
	senderKey
	type
	body

	constructor(senderKey, encryptionResult) {
		const { type, body } = encryptionResult
		this.senderKey = toByteArray(senderKey)
		this.type = type
		this.body = toByteArray(body)
	}

	static async encryptNew(payload, target, olmContext) {
		const payloadBuf = cbor.encode(payload)
		const session = await olmContext.getPeerSession(target)

		const encryptionResult = session.encrypt(payloadBuf)

		// save updated session
		const peerIdentityKey = await olmContext.getPeerIdentityKey(target)
		olmContext.sessions.updateSession(peerIdentityKey, session)
		console.debug('Resaved session after use', { peerIdentityKey })

		const senderKey = olmContext.getOwnCurve25519IdentityKey()
		const packet = new OlmPacket(senderKey, encryptionResult)
		return packet
	}

	decrypt(olmContext) {
		const decryptedBytes = olmContext.sessions.decryptPacket(this, olmContext)
		const deserialized = cborDecode(decryptedBytes)
		return deserialized
	}

	createInboundSession(olmContext) {
		const { encryptionResult } = this
		const { localAccount } = olmContext
		const session = new Olm.Session()
		session.create_inbound(localAccount, encryptionResult.body)
		return session
	}

	get senderKeyBase64() {
		return toUnpaddedBase64(this.senderKey)
	}

	get encryptionResult() {
		const { type, body } = this
		return {
			type,
			body: toUnpaddedBase64(body),
		}
	}

	encodeCBOR(encoder) {
		const { senderKey, type, body } = this
		const tagged = new Tagged(OlmPacket.CBOR_TAG, [toBuffer(senderKey), type, toBuffer(body)])
		return encoder.pushAny(tagged)
	}

	static decodeCBOR([senderKey, type, body]) {
		return new OlmPacket(senderKey, { type, body })
	}
}
