/* eslint-disable no-console */
import 'source-map-support/register'
import 'hard-rejection/register'
import chalk from 'chalk'
import { format } from 'date-fns'
import Haikunator from 'haikunator'
import { Client as IrcClient } from 'irc-framework'
import { times } from 'lodash'
import olmMiddleware from './middleware'
import distinctColors from 'distinct-colors'

const count = 20
const logRaw = true

const haikunator = new Haikunator()

const seconds = 1000

const palette = distinctColors({ count })

let created = 0

function createBot() {
	const client = new IrcClient()
	client.use(olmMiddleware())

	const color = chalk.hex(palette[created++])

	const channelName = '#megolm-test'

	client.on('registered', () => {
		client.join(channelName)
	})

	client.on('userlist', event => {
		// let the internal irc-framework event listeners complete their work so
		// the channel.users property will be correct
		// setTimeout(chatter, 5000)
		// setTimeout(() => console.log('here we go'), 25000)
		setImmediate(() => client.olm.getGroupSession(event.channel))
		setTimeout(chatter, 10000)
	})

	if (logRaw) {
		client.on('raw', event => {
			const timestamp = format(new Date(), 'hh:mm:ss.SSS')
			const direction = event.from_server ? '⇦' : '➡'
			console.log(color(`${timestamp} ${direction} ${event.line}`))
		})
	}

	client.on('megolm.message', ({ sender, target, text }) => {
		console.log(`${sender} ⇶ ${target} ⇶ ${color(client.user.nick)}: ${text}`)
	})

	client.on('megolm.packet.error', ({ sender, target, error }) => {
		console.error(`${sender} ⇶ ${target} ⇏ ${color(client.user.nick)} !!! ${error}`)
	})

	client.on('olm.packet.error', ({ sender, target, error }) => {
		console.error(`${sender} ⇏ ${color(target)} !!! ${error}`)
	})

	client.connect({
		host: 'localhost',
		port: 6667,
		nick: haikunator.haikunate(),
	})

	function chatter() {
		client.olm.sendMessage(channelName, `my favorite number is ${Math.random()}`)
		setTimeout(chatter, 5 * seconds + Math.random() * 5 * seconds)
	}
}

// HACK: remove emscripten's unhandledRejection handler which is otherwise force exiting the process
// https://github.com/kripken/emscripten/pull/5948
for (const listener of process.listeners('unhandledRejection')) {
	const bad = 'function(){process.exit(1)}'
	if (listener.toString() !== bad) continue
	console.log(`removing ${listener}`)
	process.removeListener('unhandledRejection', listener)
}

times(count, createBot)
