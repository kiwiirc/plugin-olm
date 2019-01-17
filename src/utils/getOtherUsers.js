export function getOtherUsers(channel, client) {
	const { users } = channel
	const otherUsers = users.filter(user => user.nick !== client.user.nick)
	return otherUsers
}
