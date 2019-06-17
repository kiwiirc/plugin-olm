import test from 'ava'
import DeterministicPseudorandombytes from 'deterministic-pseudorandombytes'
import NoNullsEncoding from './no-nulls-encoding'
import { toByteArray } from '../utils/toByteArray'

const TEST_DATA_COUNT = 2

test.before(t => {
	const deterministicGenerator = new DeterministicPseudorandombytes({
		seed: 'deterministic',
	})

	const random = toByteArray(deterministicGenerator.randomBytes(4096))
	const beef = toByteArray(Buffer.from('0001DEADBEEF0000DEADBEEF0100', 'hex'))

	t.context.testData = { random, beef }
})

test('encoding escapes null bytes', t => {
	const { testData } = t.context
	t.plan(TEST_DATA_COUNT * 2)

	for (const [name, bytes] of Object.entries(testData)) {
		t.true(bytes.some(byte => byte === 0x00), `${name} data contains a null byte`)
		const encoded = NoNullsEncoding.encode(bytes)
		t.true(encoded.every(byte => byte !== 0x00), `encoded ${name} data contains no null bytes`)
	}
})

test('encoding and decoding roundtrips intact', t => {
	const { testData } = t.context
	t.plan(TEST_DATA_COUNT * 1)
	for (const [name, bytes] of Object.entries(testData)) {
		const encoded = NoNullsEncoding.encode(bytes)
		const decoded = NoNullsEncoding.decode(encoded)
		t.deepEqual(decoded, bytes, `${name} data is identical after encode+decode`)
	}
})

test('encoding has expected overhead', t => {
	const { testData } = t.context
	t.plan(TEST_DATA_COUNT * 1)
	for (const [name, bytes] of Object.entries(testData)) {
		const unencodedLength = bytes.length
		const bytesToEscape = bytes.filter(byte => byte === 0x00 || byte === 0x01).length
		const encodedLength = NoNullsEncoding.encode(bytes).length
		t.is(
			encodedLength,
			unencodedLength + bytesToEscape,
			`encoded ${name} data contains an extra byte for each byte requiring escaping`,
		)
	}
})
