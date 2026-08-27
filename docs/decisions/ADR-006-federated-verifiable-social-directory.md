# ADR-006: Use a federated-verifiable social tipping directory, not username-to-address lookup

## Status

Accepted as architecture only

## Date

2026-08-27

## Context

The product needs a practical way to tip a Discord/Telegram user without manually copying a Solana address and without letting one central database become the sole directory authority or availability point. A raw username is not a safe payment identifier: Discord documents that usernames are not unique,[1] and a Telegram bot must receive a verified platform update rather than infer a user from free text.[2]

Publishing a plaintext `platform handle → wallet address` map on a public ledger creates permanent enumeration and correlation risk. Relying on one operator database creates a target for address substitution, account takeover, censorship, loss, and privacy disclosure. A generic decentralized identity/credential specification alone does not solve platform possession, record freshness, attester collusion, discovery privacy, or payment approval.

## Decision

Adopt a **federated-verifiable directory** with all of the following requirements:

1. A recipient wallet signs a short-lived, sequenced binding to an opaque, scoped social subject commitment.
2. A threshold of independent platform attesters validates a fresh Discord/Telegram control ceremony and signs narrow receipts linking the commitment to the binding hash.
3. Multiple independent replicas store and serve append-only signed records and co-sign log roots. An optional Solana program-owned root anchor commits only root/membership hashes.
4. A sender resolver verifies wallet signature, attester threshold, expiry, revocation/rotation, replica agreement, root freshness, scope, and full-address review before it can create a non-custodial transfer intent.
5. A raw handle remains a non-financial discovery hint. Discord native selection and Telegram Tip Card/reply flows are the supported inputs; a resolver never returns an address from a handle-only string.

## Alternatives considered

| Alternative | Decision | Reason |
| --- | --- | --- |
| Central database mapping handle to address | Rejected | A single operator could become an availability, privacy, and address-substitution point of failure. |
| Public on-chain plaintext handle/address records | Rejected | It enables durable social-to-wallet correlation and global enumeration. |
| Username as the primary key | Rejected | It is mutable/non-unique or not safely queryable in a verified context. |
| Wallet signature only | Rejected | It proves control of an address, not control of a social identity. |
| Platform attester signature only | Rejected | It could map a verified social identity to an address not controlled by the recipient. |
| Threshold attestation plus wallet proof, replicas, and root checkpoints | Accepted | It separates platform identity proof, address control, data availability, and resolver verification. |

## Consequences

The system will be slower and more complex than a central database, and it cannot provide global raw-handle lookup. In return, one stale/malicious/offline replica cannot silently replace a destination address, and a resolver can independently verify evidence rather than trust a database response. It remains dependent on Discord/Telegram for social identity and on governance for the active attester/membership set; those limitations are explicit and must be disclosed.

Solana accounts and PDAs can provide a program-owned root/membership commitment without holding a private key, but any registry program is a public security surface requiring explicit authority/PDA/account checks and independent audit.[3] [4]

## References

[1]: https://docs.discord.com/developers/resources/user "Discord: User Resource"
[2]: https://core.telegram.org/bots/api#user "Telegram: Bot API User"
[3]: https://solana.com/docs/core/accounts "Solana: Accounts"
[4]: https://solana.com/docs/core/pda "Solana: Program Derived Addresses"
