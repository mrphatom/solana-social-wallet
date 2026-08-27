# Solana Social Wallet

**Solana Social Wallet** is a security-first TypeScript foundation for coordinating one **shared account space** across Discord and Telegram. It proves control of separate chat identities through a source-confirmed pairing flow, resolves an opted-in recipient by stable platform identity rather than a mutable username, and creates a non-custodial Solana transfer intent that remains **awaiting wallet approval**.

> **This repository does not hold keys, sign, broadcast, settle, trade, stake, or place bets.** It is a credential-free engineering foundation, not a deployable wallet provider, exchange, staking provider, betting product, or real-fund service.

## Why this approach

Chat names are convenient, but they are not safe payment addresses. A raw Discord or Telegram username may change, collide, or be ambiguous. Solana Social Wallet instead binds a platform-native identity to a private shared account and requires the recipient to opt in before the service will produce an internal-recipient transfer intent. The sender still needs a future, independently controlled wallet companion to see the transaction details, simulate it, approve it, sign it, submit it, and track confirmation. The reviewed [key architecture](docs/non-custodial-key-architecture.md) and [secure-signing protocol](docs/secure-signing-protocol.md) define that future boundary without adding a key, signer, wallet SDK, or network call to this release.

| Capability | Implemented in the foundation | Explicitly not implemented |
| --- | --- | --- |
| Shared Discord/Telegram space | One account can link one stable identity from each supported platform using a 10-minute, hashed, one-time code and source-side confirmation. | Live Discord/Telegram bot registration, profile lookup, or raw-username account matching. |
| Recipient routing | A sender can create an intent for a known stable platform ID when the recipient is linked, has a verified Solana address, and has opted in. | Username-only transfers, guessed users, automatic delivery, escrow, or off-chain ledger balances. |
| Solana transfer preparation | Base58 public-key syntax validation, sender/recipient account checks, positive lamport amount, idempotency, and `AWAITING_WALLET_APPROVAL` state. | Private keys, recovery phrases, signatures, transaction construction, simulation, RPC calls, broadcasts, or confirmations. |
| Future signer design | Source-cited key lifecycle, external-wallet default, native-companion gates, exact-message review, signer-authority contract, and no-arbitrary-sign policy. | A deployed wallet client, key generation, recovery ceremony, Wallet Standard/MWA connection, signing, or submission. |
| Ecosystem features | Typed availability policy for buy, sell, stake, and bet requests. | Any exchange, DEX, validator, staking, betting, KYC, sanctions, or compliance provider integration. |
| Live transport hardening | Testable Discord Ed25519 raw-request verification and Telegram secret-header comparison primitives. | Public webhook routes, provider credentials, queue workers, or provider-facing API calls. |

## Quick start

```sh
git clone https://github.com/mrphatom/solana-social-wallet.git
cd solana-social-wallet
pnpm install --frozen-lockfile
pnpm demo
pnpm check
```

The deterministic local demo creates a Discord account, requests Telegram pairing, requires the Discord source identity to confirm, and reports that asset execution remains disabled without a wallet-approval bridge. It uses only in-memory data, no external network calls, and does not output a pairing code, wallet proof, private key, or credential.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Print the deliberately fail-closed local service posture. No listener or live provider is started. |
| `pnpm demo` | Run the deterministic, credential-free cross-platform pairing demonstration. |
| `pnpm lint` | Run static checks. |
| `pnpm test` | Run deterministic domain, transport-security, and command-runtime tests. |
| `pnpm build` | Compile TypeScript with strict settings. |
| `pnpm check` | Run lint, tests, and build together. |

## Architecture

Discord and Telegram are inbound transport boundaries, never a substitute for wallet ownership or signing authority. Provider-specific adapters must verify platform authenticity before creating a `PlatformActor`. The shared domain service then owns pairing, recipient resolution, transfer-intent policy, and disabled-feature policy. This separates social identity coordination from financial execution.

```text
Verified Discord / Telegram event
             │
             ▼
  provider adapter with replay controls
             │
             ▼
  shared account + recipient + intent services
             │
     ┌───────┴────────┐
     ▼                ▼
in-memory port   future reviewed persistence port
     │
     ▼
AWAITING_WALLET_APPROVAL intent
     │
     └── future separately approved wallet-confirmation bridge
```

See [the detailed architecture](docs/architecture.md), [key lifecycle](docs/non-custodial-key-architecture.md), [signing protocol](docs/secure-signing-protocol.md), [implementation checklist](docs/key-signing-implementation-checklist.md), and [decision records](docs/decisions/) for the non-custodial, stable-identity, verified-webhook, and user-controlled-signing boundaries.

## Security posture

The foundation deliberately excludes the most dangerous custody paths. It does not read `process.env`, load `.env` files, create a wallet, import a Solana SDK, construct a transaction, call an RPC endpoint, contact a trading/staking/betting provider, or open a public HTTP listener. `grep`-based release checks, strict input schemas, and safe error mapping help prevent accidental surface expansion, but they do not make the code audited or suitable for real money.

| Boundary | Current control | Required before live use |
| --- | --- | --- |
| Discord interaction | Raw-body Ed25519 verifier exists and is tested. | Live endpoint, public key secret wiring, timestamp/replay handling, rate limits, provider test suite, and deployment review. Discord requires the Ed25519/timestamp validation for HTTP interaction endpoints.[1] |
| Telegram webhook | Secret comparison primitive exists and is tested. | HTTPS endpoint, secret-token configuration, durable `update_id` deduplication, rate limits, and deployment review. Telegram delivers webhook updates as HTTPS POST and supports a secret-token header.[2] |
| Account link | Hashed, single-use code, expiry, source confirmation, and target-platform binding. | Durable transactional persistence, throttling, recipient/user disclosure, retention policy, and abuse monitoring. |
| Solana intent | Address syntax checks, opt-in recipient, wallet-account binding contract, sender-scoped idempotency. | Wallet proof protocol, explicit transaction preview, simulation, signature, broadcast, confirmation, and an independent audit. Solana distinguishes simulation, submission, and later status confirmation.[3] [4] |
| Buy/sell/stake/bet | Typed `NOT_AVAILABLE` response. | Provider, jurisdictional, financial-risk, compliance, custody, consent, and security decisions. |

## What live deployment would require

Before the service can operate a real Discord or Telegram bot, the owner must supply the relevant platform configuration through a secure secret channel and explicitly authorize the endpoint/deployment. A production implementation also needs a transactional database with database-level uniqueness, at-least-once event handling with durable idempotency records, rate limits, structured privacy-safe audit logs, alerts, backup/restore testing, incident runbooks, and periodic independent security review.

Before any **asset movement**, the owner must separately approve a wallet connection/signing protocol, target cluster, recipient presentation, fee policy, simulation policy, confirmation commitment, timeout handling, and user-visible confirmation UX. `sendTransaction` can return a signature before the cluster has processed or confirmed it, which is why this foundation never calls “submitted” a completed transfer.[4]

## References

[1]: https://docs.discord.com/developers/interactions/overview "Discord: Interactions Overview"
[2]: https://core.telegram.org/bots/api#setwebhook "Telegram Bot API: setWebhook"
[3]: https://solana.com/docs/rpc/http/simulatetransaction "Solana RPC: simulateTransaction"
[4]: https://solana.com/docs/rpc/http/sendtransaction "Solana RPC: sendTransaction"
