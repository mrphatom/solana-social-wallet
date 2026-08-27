# Architecture

## System shape

Solana Social Wallet uses a ports-and-adapters service layout. Discord and Telegram are treated as untrusted transport boundaries. Both adapters turn a verified platform event into the same internal `Actor` form, then call shared application services. The domain layer owns all identity, recipient, transfer-intent, idempotency, and capability policies; it has no dependency on a bot SDK, RPC client, private key, or signing library.

```text
Discord command / Telegram command
            │
            ▼
Provider adapter verifies authenticity and parses bounded input
            │
            ▼
Shared application services ──► repository port ──► in-memory test adapter
            │
            ├──► pairing-code policy
            ├──► recipient-resolution policy
            ├──► Solana transfer-intent policy
            └──► disabled capability registry
            │
            ▼
Safe response + allowlisted audit event
```

## One shared account space

An `Account` is an internal container that may own more than one `LinkedIdentity`. The source chat identity issues a pairing code bound to its own platform and stable user ID. A second chat identity consumes it inside its own provider context. The service stores only a hash of the code, short expiry, source identity ID, and consumption timestamp. It refuses an expired code, a replay, a code from a mismatched source context, an already-linked target identity, and a target identity already owned by a different account.

| Input form | Accepted for account link? | Accepted to create transfer intent? | Reason |
| --- | --- | --- | --- |
| Provider-verified stable ID + pairing code | Yes | Yes, after recipient conditions pass. | It proves control of both active chat identities. |
| Discord resolved user selection | Not for linking by itself | Yes, if recipient is linked and opted in. | The adapter supplies a stable platform user ID.[1] |
| Telegram user ID from a verified update | Not for linking by itself | Yes, if recipient is linked and opted in. | The verified update identifies the actor/recipient context. |
| Raw username/handle | No | No | It is display data, not stable proof or a payment destination. |
| Raw Solana address | No | Future external-send intent only; not enabled in v0.1. | External transfers need separate wallet approval UX. |

## Transfer-intent model

The current intent represents a user-visible request to pay a verified internal recipient. It contains the sender account, recipient account, recipient Solana address, amount in lamports, idempotency key, state, and safe metadata. It cannot contain private keys, seed phrases, bot tokens, raw messages, user signatures, a transaction payload, or a network submission response.

| State | Meaning | Permitted next state |
| --- | --- | --- |
| `DRAFT` | Input has not passed all policies. | `AWAITING_WALLET_APPROVAL`, `CANCELLED` |
| `AWAITING_WALLET_APPROVAL` | Recipient and transfer fields passed bot-side policy; no signature exists. | `CANCELLED`, future wallet-controlled `SIGNED` |
| `SIGNED` | Reserved for a future wallet bridge that has explicit user approval. | `SUBMITTED`, `FAILED`, `CANCELLED` |
| `SUBMITTED` | A future wallet bridge received a network signature. | `CONFIRMED`, `FAILED`, `UNKNOWN` |
| `CONFIRMED` | A future bridge reached documented commitment policy. | Terminal |
| `FAILED` / `UNKNOWN` / `CANCELLED` | No success claim is made. | Terminal |

The bot never moves an intent beyond `AWAITING_WALLET_APPROVAL`. A future wallet bridge must follow explicit simulation, submission, and confirmation semantics. Solana’s RPC documentation says `simulateTransaction` does not broadcast and `sendTransaction` does not wait for confirmation, so both state separation and user confirmation are required.[2] [3]

## Non-custodial signer plane

The new signer architecture keeps the social control plane and the private-key plane separate. A wallet-control proof permits the wallet holder to retrieve a specific intent; it cannot be replayed as spend consent. The wallet client independently parses the exact Solana message, simulates it, displays its destination/fee/account/program facts, and can sign only the resulting reviewed message. The social service never observes the seed, signing key, or signing key handle.

```text
verified social account ──► immutable transfer intent ──► short-lived approval locator
                                                             │
                                                     user-controlled wallet
                                                             │ wallet-control proof
                                                             ▼
                                                      exact reviewed message
                                                             │ local signature
                                                             ▼
                                                     direct RPC submission
                                                             │ read-only status
                                                             ▼
                                                   submitted / confirmed / unknown
```

The external wallet is the accepted production default. A first-party native signer is deferred and must encapsulate its own audited recovery/envelope/device policy. Browser/PWA storage and a native secure enclave must not be presented as equivalent Solana key protection. See the [key architecture](non-custodial-key-architecture.md), [secure-signing protocol](secure-signing-protocol.md), and [ADR-004](decisions/ADR-004-user-controlled-signer-boundary.md).

## Disabled ecosystem capabilities

Buy, sell, stake, and bet return a typed `NOT_AVAILABLE` capability result. The type is intentionally extendable: a future adapter can include provider ID, network, risk policy, explicit user approval, configured jurisdiction, and transaction approval requirements. It must not become live by changing a text label or command name.

## Future live adapters

| Adapter | Preconditions before implementation | Required verification boundary |
| --- | --- | --- |
| Discord | Application ID, public key, deployment URL, rate controls, and explicit user approval. | Verify `X-Signature-Ed25519` and `X-Signature-Timestamp` against the unmodified request body; return `401` on failure.[4] |
| Telegram | Bot token and webhook secret provided through a secure secret store, plus approved public HTTPS route. | Check configured secret header, deduplicate `update_id`, validate update shape, and reply with bounded output. Telegram documents webhook delivery as HTTPS POST and supports a secret-token header.[5] |
| Solana wallet bridge | Approved wallet protocol, network, recipient display, fee policy, simulation, and wallet-confirmation UX. | Keep signing outside the bot; use a fresh transaction at approval, preflight, and confirmation tracking. |
| Trading/staking/betting provider | Provider due diligence, jurisdictional/legal review, product policy, user disclosures, wallet execution design, and explicit approval. | Per-provider authentication, authorization, transactional consent, idempotency, compliance, and incident controls. |

## References

[1]: https://discord.com/developers/docs/interactions/receiving-and-responding "Discord: Receiving and Responding to Interactions"
[2]: https://solana.com/docs/rpc/http/simulatetransaction "Solana RPC: simulateTransaction"
[3]: https://solana.com/docs/rpc/http/sendtransaction "Solana RPC: sendTransaction"
[4]: https://docs.discord.com/developers/interactions/overview "Discord: Interactions Overview"
[5]: https://core.telegram.org/bots/api#setwebhook "Telegram Bot API: setWebhook"
