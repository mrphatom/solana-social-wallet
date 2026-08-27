# ADR-001: Use non-custodial, wallet-approved transaction intents

## Status

Accepted

## Date

2026-08-27

## Context

The product must coordinate Solana asset actions through Discord and Telegram and provide a shared account space. A bot-held signing key would turn message parsing, platform compromise, database access, operational logging, and incident response into direct custody risks. A chat interface is also not a sufficient place to conceal transaction construction, fees, simulation, or wallet approval.

## Decision

The foundation creates recipient-bound Solana transaction intents but does not receive secrets, construct signatures, submit signed transactions, or claim settlement. A future wallet-controlled confirmation bridge owns simulation, fee display, signature collection, submission, and confirmation tracking. The bot keeps transfer status distinct from wallet execution status.

## Alternatives considered

| Alternative | Decision | Rationale |
| --- | --- | --- |
| Bot-managed hot wallet | Rejected | It introduces a high-value key-custody and withdrawal-authorization target before necessary operational controls exist. |
| Embedded custodial wallet provider | Deferred | It would require provider due diligence, account/legal design, secrets, data processing, and explicit deployment approval. |
| Wallet-approved intent bridge | Accepted | It allows safe coordination and clear approval UX without assuming custody. |

## Consequences

The initial bot cannot truthfully claim to have transferred assets. It provides useful recipient routing, intent records, and future-ready contracts while requiring a separate wallet component for any financial execution. Solana’s RPC documentation distinguishes simulation, submission, and confirmation; the future adapter must preserve those state boundaries.[1] [2]

## References

[1]: https://solana.com/docs/rpc/http/simulatetransaction "Solana RPC: simulateTransaction"
[2]: https://solana.com/docs/rpc/http/sendtransaction "Solana RPC: sendTransaction"
