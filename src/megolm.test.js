import test from 'ava'
import MegolmBroker from './megolm-broker'
import OlmBroker from './olm-broker'
import { OlmPacket } from './serialization/types/index'

/* test('megolm message received', t => {
	const client = null,
		rawEvents = null
	const olmBroker = new OlmBroker({ client, rawEvents })
	const megolmBroker = new MegolmBroker({ client, rawEvents, olmBroker })


})
 */

test('can deserialize olm packet', t => {
	const packet = new OlmPacket(senderKey, encryptionResult)
})
