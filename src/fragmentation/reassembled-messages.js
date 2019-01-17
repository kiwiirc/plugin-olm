import Observable from 'zen-observable'
import { merge } from 'zen-observable/extras'
import { TAGS } from '../constants'
import { FRAGMENTABLE_TAGS } from './common'

export default function createDefragmentedMessageSource(client) {
	const allMessages = messageSource(client)

	const allFragments = allMessages.filter(isFragment)
	const unfragmented = allMessages.filter(message => !isFragment(message))

	const fragmentSets = groupFragments(allFragments)

	const defragmented = new Observable(defragmentedObserver => {
		fragmentSets.subscribe(set => {
			set.reduce((prev, next) => {
				if (prev === undefined) {
					return next
				}

				return {
					...prev,
					tags: mergeTags(prev.tags, next.tags),
				}
			}).subscribe(result => {
				defragmentedObserver.next(result)
			})
		})
	})

	return merge(unfragmented, defragmented)
}

function messageSource(client) {
	return new Observable(observer => {
		// emit messages
		const handler = message => observer.next(message)
		client.connection.on('message', handler)

		// remove listener when unsubscribed
		return () => client.connection.removeListener('message', handler)
	})
}

function isFragment(message) {
	const isFragmented = Object.keys(message.tags).includes(TAGS.FRAGMENTED)
	const hasPreviousFragment = Object.keys(message.tags).includes(TAGS.PREVIOUS_FRAGMENT)
	return isFragmented || hasPreviousFragment
}

function groupFragments(fragmentSource) {
	return new Observable(fragmentSetsObserver => {
		fragmentSource.subscribe(fragmentMessage => {
			const isInitialFragment = !Object.keys(fragmentMessage.tags).includes(
				TAGS.PREVIOUS_FRAGMENT,
			)
			if (!isInitialFragment) {
				return
			}

			const fragmentSet = new Observable(fragmentSetObserver => {
				let lastFragmentID = fragmentMessage.tags[TAGS.MSGID]
				if (!lastFragmentID) {
					return fragmentSetsObserver.error(
						new Error('Received initial fragment with no Message ID'),
					)
				}
				fragmentSetObserver.next(fragmentMessage)

				const subscription = fragmentSource.subscribe(anotherFragment => {
					const previousFragmentID = anotherFragment.tags[TAGS.PREVIOUS_FRAGMENT]
					if (previousFragmentID !== lastFragmentID) {
						return
					}
					lastFragmentID = anotherFragment.tags[TAGS.MSGID]
					if (!lastFragmentID) {
						return fragmentSetObserver.error(
							new Error('Received continuation fragment with no Message ID'),
						)
					}
					fragmentSetObserver.next(anotherFragment)
					const isFragmented = Object.keys(anotherFragment.tags).includes(TAGS.FRAGMENTED)
					if (!isFragmented) {
						fragmentSetObserver.complete()
						subscription.unsubscribe()
					}
				})
			})

			fragmentSetsObserver.next(fragmentSet)
		})
	})
}

export const EXCLUDE_TAGS = [TAGS.FRAGMENTED, TAGS.PREVIOUS_FRAGMENT]

function mergeTags(previousTags, additionalTags) {
	// keep original values by default
	const merged = { ...previousTags }

	// remove the tags used for fragmentation
	for (const tag of Object.keys(merged)) {
		if (EXCLUDE_TAGS.includes(tag)) {
			delete merged[tag]
		}
	}

	// recombine the values of fragmentable tags
	for (const [tag, val] of Object.entries(additionalTags)) {
		if (FRAGMENTABLE_TAGS.includes(tag)) {
			merged[tag] += val // string concat
		}
	}

	return merged
}
