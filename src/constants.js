export const COMMANDS = {
	PRIVMSG: 'PRIVMSG',
	TAGMSG: 'TAGMSG',
}

export const TAGS = {
	OLM_PACKET: '+kiwi/olm-packet',
	OLM_IDENTITY_REQUEST: '+kiwi/olm-identity-request',
	OLM_IDENTITY: '+kiwi/olm-identity',
	OLM_ONETIMEKEY_REQUEST: '+kiwi/olm-onetimekey-request',
	OLM_ONETIMEKEY: '+kiwi/olm-onetimekey',

	MEGOLM_STATE: '+kiwi/megolm-state',
	MEGOLM_PACKET: '+kiwi/megolm-packet',

	FRAGMENTED: '+kiwi/frag',
	PREVIOUS_FRAGMENT: '+kiwi/prev-frag',

	MSGID: 'draft/msgid',
	LABEL: 'draft/label',
	REPLY: 'draft/reply',
	TIME: 'time',
}

export const CAPABILITIES = {
	MESSAGE_TAGS: 'draft/message-tags-0.2',
	ECHO_MESSAGE: 'echo-message',
	LABELED_RESPONSE: 'draft/labeled-response',
}
