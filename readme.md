# plugin-olm

`plugin-olm` is an experimental end-to-end encryption plugin for [kiwiirc]. It is currently in a
rough prototype state.

## Protocol

The protocol has been built on top of the IRCv3 [Message Tags] standard to enable interoperability
with any clients that wish to implement it, without requiring any protocol extension by servers, or
creating incompatibility with non-implementing clients.

See [protocol.md] for protocol description and more technical background.

## What works

-   encrypted direct (query) conversations
-   encrypted group (channel) conversations
-   automatic key negotiation
-   per-channel/query toggling of encryption
-   custom UI indicating that the message was encrypted
-   persistence of keys (for self and others)
-   some handling of broken sessions, automatic renegotiation

## TODO

-   tests
-   UI for performing/storing/(indicating the status of) out-of-band verification of key
    fingerprints
-   configuration around whether encryption is opt-in, opt-out, or required
-   integration with other plugins? (filesharing)
-   channel METADATA to signal whether encryption should be used?
-   server-side prefetch/cache of one-time-keys so encrypted sessions can be created while users are
    offline
-   ...

## Demo

```console
$ git clone https://github.com/kiwiirc/plugin-olm.git
$ cd plugin-olm/docker
$ docker-compose up
```

Open https://0.0.0.0:30000 in a browser.

Click the lock icon in the bottom right to toggle encryption.

[kiwiirc]: https://github.com/kiwiirc/kiwiirc
[message tags]: https://ircv3.net/specs/core/message-tags-3.2.html
[protocol.md]: protocol.md
