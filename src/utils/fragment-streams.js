// import Observable from 'zen-observable'
// import { TAGS } from '../constants'

// export default function createFragmentSetObserver(client) {
// 	const allMessages = new Observable(observer => {
// 		const handler = message => observer.next(message)
// 		client.connection.on('message', handler)
// 		return () => client.connection.removeListener('message', handler)
// 	})

// 	const allFragments = allMessages.filter(message => {
// 		const isFragmented = Object.keys(message.tags).includes(TAGS.FRAGMENTED)
// 		const hasPreviousFragment = Object.keys(message.tags).includes(TAGS.PREVIOUS_FRAGMENT)
// 		return isFragmented || hasPreviousFragment
// 	})

// 	const fragmentSets = new Observable(fragmentSetsObserver => {
// 		allFragments.subscribe(fragmentMessage => {
// 			const isInitialFragment = !Object.keys(fragmentMessage.tags).includes(
// 				TAGS.PREVIOUS_FRAGMENT,
// 			)
// 			if (!isInitialFragment) {
// 				return
// 			}

// 			const fragmentSet = new Observable(fragmentSetObserver => {
// 				let lastFragmentID = fragmentMessage.tags[TAGS.MSGID]
// 				if (!lastFragmentID) {
// 					return fragmentSetsObserver.error(
// 						new Error('Received initial fragment with no Message ID'),
// 					)
// 				}
// 				fragmentSetObserver.next(fragmentMessage)

// 				const subscription = allFragments.subscribe(anotherFragment => {
// 					const previousFragmentID = anotherFragment.tags[TAGS.PREVIOUS_FRAGMENT]
// 					if (previousFragmentID !== lastFragmentID) {
// 						return
// 					}
// 					lastFragmentID = anotherFragment.tags[TAGS.MSGID]
// 					if (!lastFragmentID) {
// 						return fragmentSetObserver.error(
// 							new Error('Received continuation fragment with no Message ID'),
// 						)
// 					}
// 					fragmentSetObserver.next(anotherFragment)
// 					const isFragmented = Object.keys(anotherFragment.tags).includes(TAGS.FRAGMENTED)
// 					if (!isFragmented) {
// 						fragmentSetObserver.complete()
// 						subscription.unsubscribe()
// 					}
// 				})
// 			})

// 			fragmentSetsObserver.next(fragmentSet)
// 		})
// 	})

// 	return fragmentSets

// 	/*
// 	const fragmentStreams = new Observable(observer => {

// 	})

// 	///

// 	const initialFragments = allFragments.filter(message => {
// 		const hasPreviousFragment = Object.keys(message.tags).includes(TAGS.PREVIOUS_FRAGMENT)
// 		return !hasPreviousFragment
// 	})

// 	const relatedFragmentStreams = initialFragments.map(initialMessage => {
// 		let lastFragmentID = initialMessage.tags[TAGS.MSGID]
// 		if (!lastFragmentID) {
// 			throw new Error('Received initial fragment with no Message ID')
// 		}

// 		return allFragments.filter({
// 			next(message) {
// 				const previousFragment = message.tags[TAGS.PREVIOUS_FRAGMENT]
// 				if (previousFragment === lastFragmentID) {
// 					const msgID = message.tags[TAGS.MSGID]
// 					if (!msgID) {
// 						throw new Error('Received continuation fragment with no Message ID')
// 					}
// 					lastFragmentID = msgID
// 					return true
// 				}
// 				return false
// 			}
// 		})
// 	})

// 	initialFragments.subscribe({
// 		next(message) {
// 			const previousMsgID = message.tags[TAGS.MSGID]
// 			const thisFragmentStream = allMessages.filter(message => {
// 				return message.tags[TAGS.PREVIOUS_FRAGMENT] === previousMsgID
// 			})
// 		}
// 	})
// 	*/
// }
