# Non-Custodial Key and Signing Implementation Checklist

This checklist applies **before** any code creates key material, reads recovery material, connects a wallet, requests a signature, calls an RPC endpoint, or submits a transaction. It is an implementation gate, not an implementation invitation.

## Approval prerequisites

| Area | Required decision and evidence |
| --- | --- |
| Product ownership | The owner explicitly selects external-wallet-only or funds a separately reviewed native companion signer. |
| Network | Exact cluster, RPC ownership, provider/fallback policy, commitment policy, and allowed transaction types are approved. |
| Key custody | The key/recovery standard, audited libraries, native platform support, backup model, password/KDF policy, secure-deletion limitations, and device-change model are reviewed by qualified security specialists. |
| Wallet interoperability | Wallet Standard, SIWS, MWA, deep-link, and fallback behavior are chosen by platform. MWA must not be offered on environments the official support matrix marks unsupported.[1] |
| Transaction policy | Native SOL only or a separately documented extension; program/account/instruction/fee/compute/lookup-table allowlists are signed off. |
| Privacy and operations | Public-address retention, device metadata, signature handling, session lifetime, revocation, rate limits, logging exclusions, alerts, incident response, and customer disclosure are approved. |
| Legal and compliance | Jurisdictional scope, sanctions/KYC/consumer-protection obligations, provider terms, tax, staking, trading, and betting boundaries receive qualified review. |

## Engineering controls

The first production candidate must run its key-generation and recovery ceremony inside the selected user-controlled wallet or approved native client. It must use a maintained, audited Solana/wallet implementation and platform CSPRNG. It must never log, send, embed, telemetry-capture, auto-copy, or commit recovery material or private keys. Any implementation using a server-held key requires a distinct, service-owned HSM/KMS decision and must never be presented as non-custodial user custody.

The wallet-control challenge must be server-generated, one-use, audience/domain-bound, address-bound, time-bound, request-ID-bound, and verified server-side. It must say plainly that it is not a transaction. SIWS supplies a standardized request/result shape for this class of proof.[2] The wallet-control session must have explicit idle/absolute expiry, revocation, account binding, and device/client context. It must not be accepted as a payment approval.

The transaction client must build/parse an exact v1 native SOL message locally. It must reject any extra instruction/program/writable account/signer, different recipient/amount, a stale blockhash, a changed fee payer, an unsupported address lookup, simulation failure, or fingerprint mismatch. It must display full destination, amount, fee/maximum cost, network, signer/fee payer, programs, writable accounts, expiry, and a human-readable recipient label prior to local approval. Solana identifies the serialized message, not a chat command, as the material covered by the transaction signature.[3]

## Required tests

| Test class | Minimum cases |
| --- | --- |
| Key lifecycle | New-device initialization; recovery acknowledgement; no secret in logs/URLs/analytics/crash reports; envelope tamper/wrong-key failure; no cloud/chat export. |
| Wallet control | Correct SIWS proof; nonce replay; expired/not-before proof; wrong domain/audience/address; signature mismatch; session revoke; proof-is-not-payment refusal. |
| Transaction parser | Destination, amount, fee payer, signer count, writable-account, program-ID, instruction-count, compute/priority, lookup-table, data-payload, network, and fingerprint mismatch refusal. |
| Simulation/freshness | Failed simulation; changed chain state; blockhash expiry; mismatched commitment; unavailable/lagging RPC; same-commitment preflight/submission rule. |
| Signature/submission | User rejection; signature/message mismatch; submit once; returned signature is `SUBMITTED` only; confirmed/finalized/failed/unknown paths; no automatic resend. |
| Adversarial | Chat account takeover; malicious deep link; bot/API request substitution; clipboard replacement; compromised device/browser; malicious RPC response; replayed approval locator. |

## Release evidence

Before a funded testnet, retain a security review, threat model, dependency/provenance report, test results, platform matrix, accessibility review of signing screens, transaction simulation evidence, testnet manual test recording without secrets, rollback plan, incident response runbook, and independent assessment findings. Before real funds, obtain an independent wallet/custody audit and a separate go/no-go authorization.

## References

[1]: https://docs.solanamobile.com/developers/mobile-wallet-adapter "Solana Mobile: Mobile Wallet Adapter"
[2]: https://github.com/phantom/sign-in-with-solana "Sign In With Solana specification"
[3]: https://solana.com/docs/core/transactions/transaction-structure "Solana: Transaction Structure"
