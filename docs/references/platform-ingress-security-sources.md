# Discord and Telegram Platform Ingress Security Sources

**Retrieved:** 2026-08-27

This source record supports future ingress and replay-defense design only. No Discord/Telegram application, webhook URL, platform credential, or API request has been created or used.

## Discord interaction evidence

Discord supports receiving interactions through either a Gateway connection or an HTTP interactions endpoint. For an HTTP endpoint, Discord requires validation of the `X-Signature-Ed25519` and `X-Signature-Timestamp` headers on every incoming interaction; invalid signatures should receive an unauthorized response. Discord also performs routine invalid-signature checks and can remove an endpoint that fails validation. [1]

Discord interaction objects include an interaction ID, application ID, invoking user/member context, command/component data, and an interaction token. The interaction token is a response capability, not a user-session credential; any production logging design must redact it. [2]

## Telegram webhook and update evidence

Telegram Bot API updates have an `update_id` that is useful for ignoring repeated updates and recovering order. Long polling and webhooks are mutually exclusive, and a webhook delivery is retried when an endpoint returns a non-2xx status. `setWebhook` supports a secret token that Telegram includes in the `X-Telegram-Bot-Api-Secret-Token` header. [3]

Telegram’s Bot API documentation states that a bot token authorizes the bot and is used to make Bot API requests. It must be treated as a high-impact secret that is never logged, committed, shown in chat, or placed in a client bundle. [3]

## References

[1]: https://docs.discord.com/developers/interactions/overview "Discord Developer Documentation — Interactions Overview"
[2]: https://docs.discord.com/developers/interactions/receiving-and-responding "Discord Developer Documentation — Receiving and Responding to Interactions"
[3]: https://core.telegram.org/bots/api "Telegram Bot API"
