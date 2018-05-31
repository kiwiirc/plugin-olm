import test from 'ava'
import Generator from 'deterministic-pseudorandombytes'
import { deserializeFromMessageTagValue, serializeToMessageTagValue } from './message-tags'

const generator = new Generator({ seed: 'deterministic' })

const KB = 2 ** 10

test('message tag value round trips arbitrary bytes', t => {
	t.plan(1)
	const buf = generator.randomBytes(4 * KB)
	const encoded = serializeToMessageTagValue(buf)
	const decoded = deserializeFromMessageTagValue(encoded)
	t.deepEqual(decoded, buf)
})
