# ADR-002: Resolve recipients by verified stable platform identity, not username

## Status

Accepted

## Date

2026-08-27

## Context

The intended experience is “send to a user on Discord or Telegram.” Display names and usernames are user-facing conveniences, not a durable authorization or payment identity. They can change, collide, or be confused. The service must also prove that Discord and Telegram accounts are controlled by the same person before placing them in one shared space.

## Decision

Store a platform-native user identifier paired with a platform name and bind it to one internal account. Link a second platform identity only through a single-use, expiring code issued from the first verified identity and consumed in the second platform context. Resolve a recipient only from a platform adapter’s stable ID and only when the recipient has opted in to internal transfers.

## Alternatives considered

| Alternative | Decision | Rationale |
| --- | --- | --- |
| Username/handle lookup as payout key | Rejected | It is mutable, ambiguous, and cannot establish account ownership or recipient consent. |
| Automatic merge based on matching display data | Rejected | It creates account-takeover and data-leakage risk. |
| Time-limited, code-based linking | Accepted | It proves control of both active chat contexts without exposing wallet credentials. |

## Consequences

The bot may use a handle only as display text after a platform adapter has returned a stable ID. It will refuse vague/handle-only transfer requests and direct the sender to a platform-native user select, mention, or recipient link path. Discord interaction payloads include resolved users for supported command/component interaction contexts, which provides a safer adapter input than raw handle matching.[1]

## Reference

[1]: https://discord.com/developers/docs/interactions/receiving-and-responding "Discord: Receiving and Responding to Interactions"
