/* eslint-disable no-console */

import chalk from 'chalk'
import { format } from 'date-fns'
import Haikunator from 'haikunator'
import { hsluvToHex } from 'hsluv'
import { Client as IrcClient } from 'irc-framework'
import olmMiddleware from './middleware'
import { getOtherUsers } from './utils/getOtherUsers'

chalk.enabled = true

const haikunator = new Haikunator()

const seconds = 1000

function createBot() {
	const client = new IrcClient()
	client.use(olmMiddleware())

	const color = chalk.hex(hsluvToHex([Math.random() * 360, 75, 50]))

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

	client.on('secure-message', ({ sender, target, text }) => {
		// const { nick: source, params, decrypted } = message
		// const [target /* , jsonData */] = params
		console.log(`${sender} ⇶ ${color(target)}: ${text}`)
	})

	client.connect({
		host: 'localhost',
		port: 6667,
		nick: haikunator.haikunate(),
	})

	async function chatter() {
		for (const user of getOtherUsers(channel, client)) {
			client.olm.sendMessage(user.nick, `my favorite number is ${Math.random()}`)
		}
		setTimeout(chatter, 5 * seconds + Math.random() * 5 * seconds)
	}
}

let n = 2
while (n-- > 0) {
	createBot()
}
