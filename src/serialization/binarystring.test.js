import test from 'ava'
import binaryString from 'binary-string'
import Olm from 'olm'

test('null bytes can round trip through binary string', t => {
	t.plan(1)
	const buf = Buffer.from('deadbeef00000000deadbeef', 'hex')
	const binStr = binaryString.fromBuffer(buf)
	const reBuf = binaryString.toBuffer(binStr)
	t.deepEqual(buf, reBuf)
})

test('null bytes can round trip through olm', t => {
	t.plan(1)

	const alice = new Olm.Account()
	const bob = new Olm.Account()
	alice.create()
	bob.create()
	bob.generate_one_time_keys(1)

	const bobs_id_keys = JSON.parse(bob.identity_keys())
	const bobs_id_key = bobs_id_keys.curve25519
	const bobs_ot_keys = JSON.parse(bob.one_time_keys())
	let bobs_ot_key
	for (const key in bobs_ot_keys.curve25519) {
		bobs_ot_key = bobs_ot_keys.curve25519[key]
	}

	const session_to_bob = new Olm.Session()
	session_to_bob.create_outbound(alice, bobs_id_key, bobs_ot_key)

	const buf = Buffer.from('deadbeef00000000deadbeef', 'hex')
	const binStr = binaryString.fromBuffer(buf)
	// const binStr = 'hello world'
	const message_to_bob = session_to_bob.encrypt(binStr)
	// console.log(message_to_bob)

	const session_from_alice = new Olm.Session()
	session_from_alice.create_inbound(bob, message_to_bob.body)
	const plaintext = session_from_alice.decrypt(message_to_bob.type, message_to_bob.body)
	bob.remove_one_time_keys(session_from_alice)

	const decryptedBuf = binaryString.toBuffer(plaintext)

	t.deepEqual(decryptedBuf, buf)
	// t.is(plaintext, binStr)
})
