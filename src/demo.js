import IRC from "irc-framework"
import Haikunator from 'haikunator'
import getRange from 'get-range'
import { format } from 'date-fns'
import { hsluvToHex } from 'hsluv'
import chalk from 'chalk'
import { has } from 'lodash'
import { TAGS } from './constants'
import olmMiddleware from './middleware'

const haikunator = new Haikunator()

const seconds = 1000

function createBot() {
	const client = new IRC.Client()
	client.use(olmMiddleware())

	const color = chalk.hex(hsluvToHex([Math.random()*360, 75, 50]))

	let channel

	client.on('registered', () => {
		channel = client.channel('#olm-test')
		channel.join()
	})

	client.on('userlist', chatter)

	client.on('raw', event => {
		const timestamp = format(new Date(), 'hh:mm:ss.SSS')
		const direction = event.from_server ? '⇦' : '➡'
		console.log(color(`${timestamp} ${direction} ${event.line}`))
	})

	client.on('secure-message', message => {
		const { nick: source, params, decrypted } = message
		const [target, jsonData] = params
		console.log(`${source} ⇶ ${color(target)}: ${decrypted}`)
	})

	client.connect({
		host: 'localhost',
		port: 6667,
		nick: haikunator.haikunate()
	})

	function chatter() {
		const otherUsers = channel.users.filter(user => user.nick !== client.user.nick)
		for (const user of otherUsers) {
			client.olm.secureMessage(user.nick, `my favorite number is ${Math.random()}`)
		}
		setTimeout(chatter, 5*seconds + Math.random()*5*seconds)
	}
}

for (const x of getRange(2)) {
	createBot()
}
