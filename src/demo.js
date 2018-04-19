import Agent from './agent'

const connectionOptions = {
	host: 'localhost',
	port: 6667,
}

const seconds = 1000

function delay(milliseconds) {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve()
		}, milliseconds)
	})
}

async function main() {
	setInterval(() => {}, 10*seconds)
	const a = new Agent()
	const b = new Agent()

	await Promise.all([
		a.connect(connectionOptions),
		b.connect(connectionOptions),
	])

	console.log('connected')

	a.ircClient.say(b.ircClient.user.nick, 'hello')
}

main().then(() => {
	console.log('done')
})
