# Kiwi end-to-end encryption protocol

## Background

This protocol is an adaptation of [Matrix.org]'s [Olm] and [MegOlm] encryption to the IRC protocol
using [libolm]. Olm is an implementation of the [double ratchet algorithm] developed by Open Whisper
Systems and first used in the [Signal] app.

## Peer sessions

Raw byte arrays are base64 encoded without padding for transmission as [Message Tag] values.

To establish a one-on-one session with another user, we must first obtain their public identity key
and a one-time-key.

```plain
# request public identity key
@+kiwi/olm-identity-request TAGMSG bob

# receive public identity key response
@+kiwi/olm-identity=2XA4WCDGeTi9OW/XaiKXN550LUTsw0sQpi0UKANAxWZd7lLodg :bob!bob@example.com TAGMSG alice

# request one-time-key
@+kiwi/olm-onetimekey-request TAGMSG bob

# receive one-time-key response
@+kiwi/olm-onetimekey=2XA3WCDNR7uNOVnzjrvXRVA9p3FyHWLUPBP/w+GVUXkXneHYaw :bob!bob@example.com TAGMSG alice

# at this point, alice can construct an outgoing session to bob using the onetimekey and identity and start sending encrypted payloads.
```

At this point, the outbound session can be constructed locally and we can send encrypted messages
and other objects directly to this user in olm packets.

```plain
# encrypted OlmPacket containing an OlmMessage with the text "hello"
@+kiwi/olm-packet=2XA1g1ggGsgfjI52+dKMvHbHOu9ujGcUq+7Z905ah+lh+8rpehEAWKgDCiAjcvT3D6AQNHKzFXOmb6jNssLC7m+G2kHC1AsZsJOaBBIglK1cV5dWjyWpc5aTxcJhTNuXkJdlwb5Msah6jQDp9m0aIBrIH4yOdvnSjLx2xzrvboxnFKvu2fdOWofpYfvK6XoRIj8DCiDVs+9A28hvj/YpQ+7aNgh92SpAZvBJSE6hckSgF8iUZxABIhD4/ZpTTCeh8YnWjSyiEs0qvvmY8j755/o TAGMSG bob
```

When the first packet is received by the other side, they will be able to construct the session
ratchet and use it to send packets back as well.

## Group sessions

For one-to-many encryption (in IRC channels), each sender creates an outbound-only ratchet. This
mitigates some scalability issues with ongoing sessions in large channels by avoiding the need to
encrypt a copy of each message separately for each recipient. First, encrypted one-to-one sessions
must be established between participants. Once these secure channels are available they are used to
share the ratchet state for the outbound group sessions. Further details about the ratchet design
can be found in the [Megolm docs].

```plain
# encrypted OlmPacket containing a MegolmSessionState
@+kiwi/olm-packet=2XA1g1ggTR6P+jorlFtkqxc8ZjvdqqP598MYtWftFikr+wDhuCYAWQGqAwogSSqvrpm9pz7w2u+CBySrcU7G5PQrNsibQ4Mpa/JfDQwSIJagDGK3zbd23eABM1Z84FnLWb3TBFbjzPjVv0ROVZo/GiBNHo/6OiuUW2SrFzxmO92qo/n3wxi1Z+0WKSv7AOG4JiLAAgMKIEpGWJSu6xndGM1kaRGaSGOIIhXMOhv8jszNhcIrm7hnEAAikAI5NEOwE6EaoLYJkb/jfKaraL9op/XQ7ooLb7c9dnuDa0pelZ01+8VdBqIB+R+RO48dnz+QrN0N3xqHcxHSfOgP8mcdT2TanLVax8DnSgaqaLOlCeIv3vA3HQCl2BVTMUoD7j0s0fQH+v2YOZvUB8IEvVe4AOYNRcRhB+P4yz5s1AQ9/vPmOo6o/Nxu8UOHl7065pplL6ngMR5IGzECVq3ohxYpF0oXXxVT9Q0X7Arm8tLA3+LBLOSAqPfYMPySWw+YXuwwNWOFNbGm4MDVWWr/nzi7GFjc5zTGtBJkBwMAp0Qt40pUUoAdbXkW4hzJrgQnVNBZdYVkg4IDllSKCdcoWPw9/NMEYf3syS+5H1LB8Kdg+gPmEP4t TAGMSG bob
```

After receiving the MegolmSessionState, any MegolmPackets created for that session can be decrypted.

```plain
# encrypted MegolmPacket containing a MegolmMessage with the text "hello"
@+kiwi/megolm-packet=2XA6hFhdAwgAEhCHnBpj2VbBf2pS5C9oV+fJhwMgb7b9IRAdE0Lstg4lSniU/Wc8FJeY5DEE+2feUocZQkaJtRk16oyTrNH+VENClcyHBpGQsnay7qVQWoXtD1oYEKSOmZcNWCBGUHuR6rck9tWqwTbFzXNX3ipREMFLdoBJq7jwot97EFggpJKNuwSzSe+dvEnxGJysH7XnfY9AYnQTmp9PL6ffhH9YQCKLjDvQNdSZVm65HOVCbEmEud3KTL+0rgFLf6M8OukBm91wnZ8+FacjAlzGFJBYYEH3PG2zOUXUSdp7SBqI3wQ;draft/msgid=bqx72n65z1921xh7 :alice!alice@example.com TAGMSG #example
```

## Payload types and serialization

Protocol payloads are serialized to [CBOR] as tagged entities with the following tag IDs and fields:

```plain
OlmPacket
0x7035
[senderKey: Buffer, type: int, body: Buffer]
```

```plain
OlmMessage
0x7036
text: string
```

```plain
OlmOneTimeKey
0x7037
oneTimeKey: Buffer
```

```plain
OlmIdentity
0x7038
curve25519IdentityKey: Buffer
```

```plain
MegolmMessage
0x7039
text: string
```

```plain
MegolmPacket
0x703a
[ciphertext: Buffer, senderKey: Buffer, sessionID: Buffer, signature: Buffer]
```

```plain
MegolmSessionState
0x703b
[sessionID: Buffer, sessionKey: Buffer, messageIndex: Buffer]
```

[matrix.org]: https://matrix.org
[olm]: https://git.matrix.org/git/olm/about/docs/olm.rst
[megolm]: https://git.matrix.org/git/olm/about/docs/megolm.rst
[libolm]: https://git.matrix.org/git/olm/about/docs/olm.rst
[double ratchet algorithm]: https://signal.org/docs/specifications/doubleratchet/
[signal]: https://signal.org/
[message tag]: https://ircv3.net/specs/core/message-tags-3.2.html
