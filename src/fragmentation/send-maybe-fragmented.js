import { partitionObject } from '../utils/partitionObject'
import { toUnpaddedBase64 } from '../utils/toUnpaddedBase64'
import { awaitMessage } from '../utils/awaitMessage'
import IrcMessage from 'irc-framework/src/ircmessage'
import FragmentGenerator from './fragment-generator'
import { TAGS } from '../constants'
import { FRAGMENTABLE_TAGS } from './common'
import { shorten } from '../utils/shorten'

// IRCv3.3 Message Tags https://ircv3.net/specs/core/message-tags-3.3.html#size-limit
// const CLIENT_TAGS_MAX_LENGTH = 4096
// const CLIENT_TAGS_MAX_LENGTH = 4096 - 512 // safety margin until oragono is fixed
const CLIENT_TAGS_MAX_LENGTH = 512 // safety margin until inspircd is fixed

function clientTagBytes(tags) {
	let clientTagBytes = 0
	if (Object.keys(tags).length > 0) {
		clientTagBytes += '@'.length
	}
	for (const [tag, val] of Object.entries(tags)) {
		clientTagBytes += tag.length
		if (val) {
			clientTagBytes += '='.length
			clientTagBytes += val.length
		}
		clientTagBytes += ';'.length // final tag will be followed by a space instead of semicolon, but same length.
	}
	return clientTagBytes
}

function generateLabelID() {
	const len = 8
	let randomBytes
	if (crypto.randomBytes) {
		randomBytes = crypto.randomBytes(len)
	} else if (crypto.getRandomValues) {
		randomBytes = new Uint8Array(len)
		crypto.getRandomValues(randomBytes)
	} else {
		throw new Error('No crypto.randomBytes or crypto.getRandomValues method available')
	}
	return toUnpaddedBase64(randomBytes)
}

// eslint-disable-next-line import/prefer-default-export
export default async function sendMaybeFragmented(ircMessage, client) {
	// FIXME: bytes vs characters?

	const unfragmentedBytes = clientTagBytes(ircMessage.tags)

	if (unfragmentedBytes <= CLIENT_TAGS_MAX_LENGTH) {
		return client.raw(ircMessage.to1459()) // HACK: shouldn't have to explicitly call this method but there's an instanceof check inside .raw that webpack breaks
	}

	const { tags, prefix, nick, hostname, command, params } = ircMessage

	const [fragmentableTags, unfragmentableTags] = partitionObject(tags, tag =>
		FRAGMENTABLE_TAGS.includes(tag),
	)
	const fragmentableTagsEntries = Object.entries(fragmentableTags)
	if (fragmentableTagsEntries.length > 1) {
		throw new Error('Fragmentation of multiple tags is not supported')
	} else if (fragmentableTagsEntries.length < 1) {
		throw new Error('Client tags maximum length violated without any fragmentable tags')
	}
	const [fragmentableTag, fragmentableTagValue] = fragmentableTagsEntries[0]

	// const onlyUnfragmentableBytes = clientTagBytes(unfragmentableTags)

	console.debug(`sending fragmented: @${fragmentableTag}=${fragmentableTagValue}`)

	const fragmentGenerator = new FragmentGenerator(fragmentableTagValue)
	let first = true
	let previousMsgID
	while (fragmentGenerator.more) {
		// use supplied label for first fragment
		const labelID = (first ? unfragmentableTags[TAGS.LABEL] : undefined) || generateLabelID()

		const chunkUnfragmentableTags = {
			...unfragmentableTags,
			[TAGS.LABEL]: labelID,
		}
		if (previousMsgID) {
			chunkUnfragmentableTags[TAGS.PREVIOUS_FRAGMENT] = previousMsgID
		}
		const fragmentedTagSize = ';'.length + TAGS.FRAGMENTED.length
		const fragmentableTagNonValueSize = ';'.length + fragmentableTag.length + '='.length
		const nonDataSize = clientTagBytes(chunkUnfragmentableTags) + fragmentableTagNonValueSize
		const noMoreFragmentsNeeded =
			CLIENT_TAGS_MAX_LENGTH - nonDataSize - fragmentGenerator.remaining >= 0
		const nonDataSizeFragmented = nonDataSize + fragmentedTagSize
		const chunkSize = noMoreFragmentsNeeded
			? fragmentGenerator.remaining
			: CLIENT_TAGS_MAX_LENGTH - nonDataSizeFragmented
		if (chunkSize < 32 && fragmentGenerator.remaining / chunkSize > 5) {
			throw new Error('Not enough client tag space to make reasonable progress')
		}

		const chunk = fragmentGenerator.next(chunkSize)
		console.debug('sending chunk', shorten(chunk))
		const chunkMessage = new IrcMessage(command, ...params)
		chunkMessage.prefix = prefix
		chunkMessage.nick = nick
		chunkMessage.hostname = hostname
		chunkMessage.tags = {
			...chunkUnfragmentableTags,
			[fragmentableTag]: chunk,
		}
		if (fragmentGenerator.more) {
			chunkMessage.tags[TAGS.FRAGMENTED] = true
		}

		const echoPromise = awaitMessage(
			client,
			msg => Object.keys(msg.tags).includes(TAGS.LABEL) && msg.tags[TAGS.LABEL] === labelID,
		)

		client.raw(chunkMessage.to1459()) // HACK

		const echo = await echoPromise
		previousMsgID = echo.tags[TAGS.MSGID]
		if (!previousMsgID) {
			throw new Error('Echoed message fragment has no Message ID.')
		}

		first = false
	}
}
