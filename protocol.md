# Kiwi end-to-end encryption protocol

## Background

This protocol is an adaptation of [Matrix.org]'s [Olm] and [MegOlm] encryption to the IRC protocol
using [libolm]. Olm is an implementation of the [double ratchet algorithm] developed by Open Whisper
Systems and first used in the [Signal] app.

## Peer sessions

Raw byte arrays are base64 encoded without padding for transmission as [Message Tag] values.

To establish a one-on-one session with another user, we must first obtain their public identity key
and a one-time-key.

```irc
# request public identity key
@+kiwi/olm-identity-request TAGMSG bob

# receive public identity key response
@+kiwi/olm-identity=2XA4WCDGeTi9OW/XaiKXN550LUTsw0sQpi0UKANAxWZd7lLodg :bob!bob@example.com TAGMSG alice

# request one-time-key
@+kiwi/olm-onetimekey-request TAGMSG bob

# receive one-time-key response
@+kiwi/olm-onetimekey=2XA3WCDNR7uNOVnzjrvXRVA9p3FyHWLUPBP/w+GVUXkXneHYaw :bob!bob@example.com TAGMSG alice
```

At this point, alice can construct an outgoing session to bob using the onetimekey and identity and
start sending encrypted payloads such as OlmMessages:

```irc
# encrypted OlmPacket containing an OlmMessage with the text "hello"
@+kiwi/olm-packet=2XA1g1ggGsgfjI52+dKMvHbHOu9ujGcUq+7Z905ah+lh+8rpehEAWKgDCiAjcvT3D6AQNHKzFXOmb6jNssLC7m+G2kHC1AsZsJOaBBIglK1cV5dWjyWpc5aTxcJhTNuXkJdlwb5Msah6jQDp9m0aIBrIH4yOdvnSjLx2xzrvboxnFKvu2fdOWofpYfvK6XoRIj8DCiDVs+9A28hvj/YpQ+7aNgh92SpAZvBJSE6hckSgF8iUZxABIhD4/ZpTTCeh8YnWjSyiEs0qvvmY8j755/o TAGMSG bob
```

When the first packet is received by the other side, they will be able to construct the session
ratchet and use it to send packets back as well.

## Group sessions

For one-to-many encryption (in IRC channels), each sender creates an outbound-only ratchet. This
mitigates some scalability issues with ongoing sessions in large channels by avoiding the need to
encrypt a copy of each message separately for each recipient. First, encrypted one-to-one sessions
must be established between participants, as described in the previous section. Once these secure
channels are available they are used to share the ratchet state for the outbound group sessions.
Further details about the ratchet design can be found in the [Megolm docs].

```irc
# encrypted OlmPacket containing a MegolmSessionState
@+kiwi/olm-packet=2XA1g1ggTR6P+jorlFtkqxc8ZjvdqqP598MYtWftFikr+wDhuCYAWQGqAwogSSqvrpm9pz7w2u+CBySrcU7G5PQrNsibQ4Mpa/JfDQwSIJagDGK3zbd23eABM1Z84FnLWb3TBFbjzPjVv0ROVZo/GiBNHo/6OiuUW2SrFzxmO92qo/n3wxi1Z+0WKSv7AOG4JiLAAgMKIEpGWJSu6xndGM1kaRGaSGOIIhXMOhv8jszNhcIrm7hnEAAikAI5NEOwE6EaoLYJkb/jfKaraL9op/XQ7ooLb7c9dnuDa0pelZ01+8VdBqIB+R+RO48dnz+QrN0N3xqHcxHSfOgP8mcdT2TanLVax8DnSgaqaLOlCeIv3vA3HQCl2BVTMUoD7j0s0fQH+v2YOZvUB8IEvVe4AOYNRcRhB+P4yz5s1AQ9/vPmOo6o/Nxu8UOHl7065pplL6ngMR5IGzECVq3ohxYpF0oXXxVT9Q0X7Arm8tLA3+LBLOSAqPfYMPySWw+YXuwwNWOFNbGm4MDVWWr/nzi7GFjc5zTGtBJkBwMAp0Qt40pUUoAdbXkW4hzJrgQnVNBZdYVkg4IDllSKCdcoWPw9/NMEYf3syS+5H1LB8Kdg+gPmEP4t TAGMSG bob
```

After receiving the MegolmSessionState, any MegolmPackets created with that session from that point
forward can be decrypted.

```irc
# encrypted MegolmPacket containing a MegolmMessage with the text "hello"
@+kiwi/megolm-packet=2XA6hFhdAwgAEhCHnBpj2VbBf2pS5C9oV+fJhwMgb7b9IRAdE0Lstg4lSniU/Wc8FJeY5DEE+2feUocZQkaJtRk16oyTrNH+VENClcyHBpGQsnay7qVQWoXtD1oYEKSOmZcNWCBGUHuR6rck9tWqwTbFzXNX3ipREMFLdoBJq7jwot97EFggpJKNuwSzSe+dvEnxGJysH7XnfY9AYnQTmp9PL6ffhH9YQCKLjDvQNdSZVm65HOVCbEmEud3KTL+0rgFLf6M8OukBm91wnZ8+FacjAlzGFJBYYEH3PG2zOUXUSdp7SBqI3wQ;draft/msgid=bqx72n65z1921xh7 :alice!alice@example.com TAGMSG #example
```

All of the protocol sample codeblocks up to this point form a complete key negotiation and
conversation between two users in both one-to-one mode and group mode.

## Payload types and serialization

Protocol payloads are serialized to [CBOR] as tagged entities with the following tag IDs and fields:

### OlmPacket

- CBOR tag: `0x7035`
- CBOR value: `[senderKey: ByteString, type: int, body: ByteString]`

The body field can contain an encrypted OlmMessage or MegolmSessionState.

### OlmMessage

- CBOR tag: `0x7036`
- CBOR value: `text: string`

A single chat message in a peer session.

### OlmOneTimeKey

- CBOR tag: `0x7037`
- CBOR value: `oneTimeKey: ByteString`

Combined with an OlmIdentity, OlmOneTimeKey is used to initialize a new peer session.

### OlmIdentity

- CBOR tag: `0x7038`
- CBOR value: `curve25519IdentityKey: ByteString`

### MegolmMessage

- CBOR tag: `0x7039`
- CBOR value: `text: string`

A single chat message in a group session.

### MegolmPacket

- CBOR tag: `0x703a`
- CBOR value: `[ciphertext: ByteString, senderKey: ByteString, sessionID: ByteString, signature: ByteString]`

Ciphertext contains an encrypted MegolmMessage.

### MegolmSessionState

- CBOR tag: `0x703b`
- CBOR value: `[sessionID: ByteString, sessionKey: ByteString, messageIndex: ByteString]`

Contains the ratchet state necessary to decrypt received MegolmPackets from a user.

## Message Tag fragmentation

Because the serialized payloads can be particularly large, the message tag data will sometimes be
split across multiple IRC messages.

When a message is fragmented, it is marked with the tag `@+kiwi/fragmented`. When a message is a
continuation of a previous fragment, it is tagged `@+kiwi/previous-frag=<previous message ID>`.

Fragmentation is only allowed on the following tags' values:

```plain
+kiwi/olm-packet
+kiwi/olm-identity
+kiwi/olm-onetimekey
+kiwi/megolm-state
+kiwi/megolm-packet
```

The tag values should be split into chunks of as large a size as possible within the limitations of
the Message Tags spec. The chunks do not need to be of equal size, but they must be transmitted in
order.

A client must not interpret the fragmented data until it has been reconstructed, with the final
fragment being indicated by the lack of a `@+kiwi/fragmented` tag.

For example, `@+kiwi/olm-packet=abcdefghijklmnopqrstuvwxyz TAGMSG user` could be fragmented as
follows:

```irc
# receiver view:
@+kiwi/olm-packet=abcdef;+kiwi/fragmented;draft/msgid=100 TAGMSG user
@+kiwi/olm-packet=ghijklmnopq;+kiwi/fragmented;+kiwi/previous-frag=100;draft/msgid=101 TAGMSG user
@+kiwi/olm-packet=rstuvwxyz;+kiwi/previous-frag=101;draft/msgid=102 TAGMSG user
```

The sender will need to use a `label` tag and the `echo-message` capability to find the
`draft/msgid` of their sent message fragment in order to reference it with the `+kiwi/previous-frag`
tag.

## Points of difficulty / Room for improvement

### Tag fragmentation

1. It's unfortunate to have to reimplement layer 3 IP packet fragmentation inside a layer 7
   protocol.
2. Calculating the available space for each fragment of data is somewhat tedious because it depends
   on the length of the server's generated msgids, whether we're trying to send the first, last, or
   a middle fragment, and so on.
3. Having to use `echo-message` with a `label` to find out your own `msgid` adds significant latency
   since we can't predict or generate our own `msgid`s.
4. Care must be taken to avoid DoS from yourself (if the available data space in client tags was
   very small due to other tags being present) or others (i.e. resource leaks from never completing
   the reassembly process).

### Binary encoding overhead

Not having a way to directly transmit binary data causes significant overhead through base64
encoding.

### Message Tags vs CBOR tagged entities

There is some impedance mismatch between the Message Tags the CBOR serialized records. For example,
MegolmPacket packs four different values into one tag because using a separate Message Tag for each
part would be quite verbose, which eats into the space available for the actual data. The values of
our tags end up being self-describing through very efficient headers inside the CBOR serialization,
so it's tempting to only use a `+kiwi/olm` tag for everything instead.

The self-describing serialized values are necessary for part of the protocol due to the end-to-end
encryption itself: some of the protocol messages need to be encapsulated inside encrypted blobs, and
we might as well not leak metadata about the nature of the encrypted payload.

But I stuck with multiple separate Message Tags in an attempt to mesh with the human-readable style
of the IRC protocol to the extent it was possible.

[Matrix.org]: https://matrix.org
[Olm]: https://git.matrix.org/git/olm/about/docs/olm.rst
[Megolm]: https://git.matrix.org/git/olm/about/docs/megolm.rst
[libolm]: https://git.matrix.org/git/olm/about/docs/olm.rst
[double ratchet algorithm]: https://signal.org/docs/specifications/doubleratchet/
[Signal]: https://signal.org/
[Message Tag]: https://ircv3.net/specs/core/message-tags-3.2.html
[CBOR]: http://cbor.io/
