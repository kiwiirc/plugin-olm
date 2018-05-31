import test from 'ava'
import Generator from 'deterministic-pseudorandombytes'
import YEnc from './yenc'

const generator = new Generator({ seed: 'deterministic' })

const KB = 2 ** 10

test('yEnc generator round trips random bytes', t => {
	const bytes = generator.randomBytes(4 * KB)
	const encodedIterable = YEnc.encoder(bytes)
	const decodedIterable = YEnc.decoder(encodedIterable)
	const decoded = Buffer.from(new Uint8Array(decodedIterable))
	t.deepEqual(decoded, bytes)
})
