# ADR-004: Keep user key generation and signing outside the social bot

## Status

Accepted

## Date

2026-08-27

## Context

Solana Social Wallet coordinates identities and transfer intents across Discord and Telegram. The user requested a non-custodial cryptographic key-generation and secure-signing architecture. The existing intent boundary prevents the bot from signing, but a durable decision is needed for wallet-control proof, external wallets, a possible first-party signer, recovery, and transaction execution.

## Decision

The production-default approach is a user-controlled external Solana wallet. The bot issues a replay-resistant wallet-control challenge, verifies it server-side, and stores only public binding metadata. It then exposes immutable recipient-bound intents to a wallet client. The wallet signs only after a fresh local review and submits directly to an allowed Solana RPC. The bot neither creates nor holds user key material and does not submit on the user's behalf.

Any first-party signer is deferred to a dedicated native companion application. It must use an audited key/recovery implementation, encrypted local envelope, platform-protected wrapping key, local user-presence check, and an independent security review. Browser/PWA vault storage remains a low-assurance test/development path and is not a real-value custody recommendation.

## Alternatives considered

| Alternative | Decision | Rationale |
| --- | --- | --- |
| Bot-managed Solana keypair | Rejected | It makes a chat bot, queues, logs, database, deployment, and operator access a direct user-asset custody target. |
| Bot receives client seed phrase and encrypts it | Rejected | Encryption at the bot does not remove custody or recovery-phishing risk. |
| External wallet per transaction | Accepted | The user's existing wallet retains key management and local signing authority. Solana identifies browser wallets as an end-user, per-transaction approach.[1] |
| Dedicated native companion signer | Deferred | It can improve local key protection but creates a high-risk product with recovery, device, platform, supply-chain, and audit obligations. |
| Browser/PWA wallet as primary custody | Rejected for real funds | Browser non-extractable keys are not a hardware-isolation guarantee, and browser storage is not a durable recovery model.[2] |

## Consequences

The bot may provide useful identity routing and transfer intent coordination but cannot claim that it moved assets. It also cannot recover a user's wallet or rescue assets. Wallet control must be established separately from chat identity, and the implementation must keep every transaction's review, signature, submission, and confirmation distinct.

Solana transaction signatures are Ed25519 signatures over the serialized transaction message; the message includes account permissions, blockhash, and instructions. A signed submission is not a confirmation, so a future signer bridge must keep those states separate.[3] [4]

## References

[1]: https://solana.com/docs/core/transactions/signing-in-production "Solana: Signing in Production"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey/extractable "MDN: CryptoKey extractable"
[3]: https://solana.com/docs/core/transactions/transaction-structure "Solana: Transaction Structure"
[4]: https://solana.com/docs/rpc/http/sendtransaction "Solana RPC: sendTransaction"
