# ADR-003: Treat live chat platforms as verified inbound adapters

## Status

Accepted

## Date

2026-08-27

## Context

Discord and Telegram bot messages arrive from external systems. Without platform verification and replay handling, anyone who can reach an endpoint may create account links or transaction intents as another user. The source data must therefore be authenticated before it becomes an internal actor.

## Decision

The initial code includes only local/typed adapter contracts and does not connect to live providers. A production Discord HTTP adapter must verify the Ed25519 signature and timestamp over the unmodified body before parsing an interaction. A production Telegram webhook adapter must use a configured secret token, accept only HTTPS delivery, and durably deduplicate the documented update identifier. Both adapters must reduce provider payloads to bounded internal input and must not pass raw payloads into logs, persistence, or domain decisions.

## Alternatives considered

| Alternative | Decision | Rationale |
| --- | --- | --- |
| Trust raw public HTTP payloads | Rejected | It allows identity spoofing and unauthorized intent creation. |
| Use one shared bot token as sender identity | Rejected | A bot token authenticates the service to a provider, not a human actor. |
| Provider-specific verified adapters | Accepted | It contains platform protocol details and gives the shared domain a stable authenticated actor contract. |

## Consequences

The foundation remains runnable without provider credentials. Live setup has clear code and operational prerequisites rather than a misleading “works with Discord/Telegram” claim. Discord documents required Ed25519/timestamp request validation for HTTP interactions, while Telegram documents HTTPS webhook delivery and an optional secret-token request header.[1] [2]

## References

[1]: https://docs.discord.com/developers/interactions/overview "Discord: Interactions Overview"
[2]: https://core.telegram.org/bots/api#setwebhook "Telegram Bot API: setWebhook"
