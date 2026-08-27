# ADR-005: Require review-first signing of an exact parsed Solana message

## Status

Accepted

## Date

2026-08-27

## Context

The social bot can create a legitimate recipient-bound transfer intent, but an intent is not a transaction. Solana signatures cover the serialized transaction message, which includes account roles, recent blockhash, and compiled instructions. A bot-generated chat command, display name, or opaque transaction blob cannot give a user enough information to understand what a signature authorizes.

## Decision

A future signer bridge must construct or independently parse the exact Solana transaction message locally, simulate it where feasible, show a human-readable summary plus critical account/program details, and request an explicit local signature only after the user reviews it. The client then verifies that signed message bytes equal the reviewed message before a separate direct submission action. Any change invalidates the request and requires another review.

The v1 parser supports only one native SOL System Program transfer, with exactly one signer/fee payer and no extra programs or instructions. The bot cannot send serialized transaction data in chat and cannot convert a wallet-control proof into a spend authorization.

## Alternatives considered

| Alternative | Decision | Rationale |
| --- | --- | --- |
| Sign a bot-provided opaque serialized transaction | Rejected | The user and client cannot reliably see whether the payload contains a changed destination, extra program, account, fee, or authority. |
| Trust server-side transfer summary only | Rejected | A compromised or faulty service could summarize a different message from the one the wallet signs. |
| Sign logical intent fields instead of Solana message | Rejected | A logical intent lacks exact blockhash, account permissions, program invocation, and message serialization. |
| Parse and sign only a strict native-SOL transfer message | Accepted | It keeps the v1 authority surface small and enables exact client-side comparison. |

## Consequences

The v1 scope is intentionally narrow and cannot execute token/SPL, stake, swap, program, multi-instruction, batch, or arbitrary-message requests. Rebuilding due to blockhash expiry requires a fresh simulation, review, and signature; it is not a transparent retry.

Solana documents that transaction signatures cover the serialized message and that native SOL transfers do not themselves ensure recipient suitability. It also documents that simulation does not broadcast and submission does not establish confirmation.[1] [2] [3]

## References

[1]: https://solana.com/docs/core/transactions/transaction-structure "Solana: Transaction Structure"
[2]: https://solana.com/docs/rpc/http/simulatetransaction "Solana RPC: simulateTransaction"
[3]: https://solana.com/docs/rpc/http/sendtransaction "Solana RPC: sendTransaction"
