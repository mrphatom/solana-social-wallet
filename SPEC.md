# Solana Social Wallet — Foundation Specification

## Objective

Solana Social Wallet is a **non-custodial, Solana-first account-coordination service** for Discord and Telegram. It lets a user prove control of one Discord identity and one Telegram identity, link both to a single account space, discover a verified recipient inside a supported platform, and create a clear, durable transfer intent. It does not hold user private keys, sign transactions, broadcast transactions, or move assets in this release.

The project addresses a practical chat-wallet problem: an identifiable recipient may be easier to find than a base58 address, but a mutable display name is not a safe payment target. The service resolves a platform-native identity only after the recipient has linked and opted in, then returns an intent requiring a separately controlled wallet to display, simulate, sign, and submit.

> **Safety and maturity boundary:** This is an unaudited engineering foundation. It is not a wallet custodian, exchange, staking provider, betting platform, payment processor, investment adviser, or legal/compliance system. It must not be connected to real funds, live trade/stake/bet providers, or production bot credentials until a separate implementation, threat model, provider review, legal review, and explicit deployment authorization are complete.

## Assumptions

| Assumption | Consequence |
| --- | --- |
| The initial deliverable is a TypeScript service and local deterministic demo, not a live hosted bot. | No Discord/Telegram credentials, webhooks, or real user data are required or stored. |
| Users control a separate Solana wallet. | The bot never receives private keys, seed phrases, signatures, or custody of assets. |
| Platform usernames are mutable/display-only. | Internal delivery requires a verified platform-native user ID and an explicit recipient opt-in. |
| The release must remain useful without financial execution. | It creates/validates audited intent state and transaction-request boundaries instead of pretending transfers occurred. |
| Future networks will be added deliberately. | Solana-specific rules sit behind chain and capability interfaces, not scattered through message adapters. |

## Command contract

| Command | Purpose |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install the locked project dependencies. |
| `pnpm dev` | Run the local HTTP command-simulation service. |
| `pnpm demo` | Execute a deterministic cross-platform pairing and transfer-intent demonstration; no network calls. |
| `pnpm lint` | Run ESLint across production and test code. |
| `pnpm test` | Run deterministic Vitest unit/integration tests. |
| `pnpm build` | Type-check and emit the production JavaScript build. |

## Project structure

| Path | Responsibility |
| --- | --- |
| `src/domain/` | Pure domain types, pairing policy, recipient resolution, capability policy, and intent state transitions. |
| `src/application/` | Use cases that enforce authorization and compose ports. |
| `src/adapters/` | In-memory persistence, local command parsing, and deferred Discord/Telegram webhook adapter contracts. |
| `src/http/` | Local-only HTTP interface and safe error serialization. |
| `src/observability/` | Structured, allowlisted event logging with correlation identifiers. |
| `src/index.ts` | Dependency wiring and local server bootstrap. |
| `src/demo.ts` | Deterministic, credential-free foundation demonstration. |
| `test/` | Unit and small integration tests. |
| `docs/` | Architecture, operations, threat model, QA, and decision records. |

## Code style

The service uses TypeScript ESM with strict compiler settings. Domain state uses discriminated unions; IDs are branded types; boundary inputs are parsed once with Zod; adapters satisfy narrow interfaces. A successful result is explicit and errors expose a stable code plus a safe user message rather than stack traces.

```ts
// Internal code receives validated data, then makes one policy decision.
export function canResolveRecipient(identity: LinkedIdentity): RecipientResolution {
  if (!identity.acceptsInternalTransfers) {
    return { kind: 'recipient-unavailable', reason: 'RECIPIENT_OPT_IN_REQUIRED' }
  }
  return { kind: 'resolved-recipient', accountId: identity.accountId, walletAddress: identity.walletAddress }
}
```

## Functional scope

| Capability | v0.1 foundation | Explicit non-goal |
| --- | --- | --- |
| Cross-platform account | One account space can own distinct verified Discord/Telegram identities. | Username-only merges or implicit links. |
| Pairing | One-time, hashed, expiring code proves control of a second identity. | Pairing based only on a user-entered handle. |
| Recipient lookup | Resolve platform-native recipient identity if linked and opted in. | Searching/guessing public platform usernames as a transfer target. |
| Solana transfer intent | Validate base58 address and positive lamports, create recipient-bound `AWAITING_WALLET_APPROVAL` intent. | Key custody, signing, broadcast, settlement, or off-chain ledger credits. |
| Wallet confirmation bridge | Typed approval-request contract for a future trusted wallet companion. | An embedded wallet, bot-held key, hidden signing, or automatic resubmission. |
| Ecosystem capability registry | Discover disabled buy, sell, stake, and bet contracts with reason codes. | Provider integration, price execution, delegation, wagers, or compliance claims. |
| Chat transport | Provider-neutral command/event contracts; local simulation endpoint. | Live webhook registration or message delivery without user-supplied credentials. |

## Safety, authorization, and data boundaries

### Always do

- Validate Discord, Telegram, HTTP, and future provider input at the adapter boundary.
- Require both identity ownership proof and account ownership checks before linking/removing an identity.
- Generate high-entropy one-time pairing codes, persist only a hash, set a short expiration, bind the code to source identity/platform, and invalidate it upon consumption.
- Resolve recipients with stable platform IDs, explicit transfer opt-in, and a linked account/wallet address.
- Use idempotency keys for client-visible intents and immutable, non-sensitive audit events for state changes.
- Keep `DRAFT`, `AWAITING_WALLET_APPROVAL`, `SIGNED`, `SUBMITTED`, `CONFIRMED`, `FAILED`, and `UNKNOWN` distinct; do not call a submitted transaction settled.
- Use allowlisted structured telemetry with a correlation ID; exclude raw message bodies, secrets, private keys, seed phrases, wallet signatures, and complete chat-user content.

### Ask first

- Adding live Discord or Telegram credentials, registering a webhook, enabling a public endpoint, deploying the service, or creating a production database.
- Connecting a wallet adapter/WalletConnect provider, receiving a user signature, broadcasting a transaction, sending a message to a live account, or moving any funds.
- Adding exchange, DEX, staking, validator, betting, KYC, sanctions, custody, or identity-verification providers.
- Storing any new PII or changing the data-retention policy.

### Never do

- Accept, store, log, or transmit a user private key, seed phrase, password, access token, webhook secret, or bot token.
- Treat a display name, handle, or a claimed wallet address as proof of recipient identity.
- Auto-approve, auto-sign, auto-submit, retry, or silently replace a financial transaction intent.
- Pretend an intent is a transfer, a transaction signature is a confirmation, an unavailable provider is working, or a disabled capability is enabled.
- Ship live buy/sell/stake/bet functionality or gambling advice/execution under this foundation.

## Security and transaction model

The pairing flow creates a source-bound, 10-minute one-time code. The second platform identity must present that code in its own chat context; an already linked identity is refused. Recipient lookup takes a **stable platform user ID** obtained by the platform adapter—such as a Discord command’s resolved user—not a user-typed handle. Direct messages can display a safe disambiguation response but cannot create an intent from an unresolved handle.

An approved recipient lookup produces a transfer request containing a Solana public address and positive lamport amount. The current service only creates an `AWAITING_WALLET_APPROVAL` intent; it cannot construct a signed transaction without an explicit future wallet-confirmation implementation. A future bridge must use the same simulation/preflight commitment as submission and must separately track submitted, confirmed, failed, and unknown outcomes. Solana documents that simulation does not broadcast, and that `sendTransaction` returning a signature does not guarantee cluster confirmation.[1] [2]

The service intentionally defaults capability contracts for **BUY**, **SELL**, **STAKE**, and **BET** to disabled. They are visible only as explicit `NOT_AVAILABLE` results so future work can add a reviewed adapter without silently broadening the command surface.

## Persistence model

The first release supplies an in-memory repository for tests and local demos. Its production interface is relational and designed for a future PostgreSQL implementation. Required durability invariants are unique `(platform, platform_user_id)` identity ownership, one active pairing code per source identity, consumed-code invalidation, unique idempotency key per account/action, and append-only event records. A production migration must add its own reviewed schema and rollback plan.

## Testing strategy

Most coverage is deterministic, small tests of domain policies. Small integration tests use the in-memory repository to cover an end-to-end sequence: create account → bind Discord → issue pairing code → consume code in Telegram → opt recipient in → resolve platform-native recipient → create transfer intent. Negative tests must cover expired/replayed/cross-account pairing codes, username-only resolution refusal, recipient opt-out, invalid Solana destination, zero/negative amount, duplicate idempotency key, disabled ecosystem capabilities, and prohibited state transitions.

Live API tests, live webhook tests, wallet signatures, RPC calls, exchange orders, stake instructions, bets, real bot messages, and production database migration tests are intentionally excluded from this credential-free foundation.

## Success criteria

- The repository compiles, lints, and passes its deterministic tests without credentials or network access.
- One owner can link Discord and Telegram identities only through an expiring one-time proof; replay and cross-account use are rejected.
- A sender can select a linked, opt-in recipient by stable Discord/Telegram identity and receive a recipient-bound Solana transfer intent.
- A handle-only recipient is never treated as a payout target.
- All live asset actions and unavailable ecosystem actions return explicit safe states; no signer, seed phrase, network broadcast, provider call, or custody path exists.
- The README, threat model, decision records, operations guide, and QA record state the limitations, official sources, deployment gates, and future work without claiming production custody readiness.

## Official references

[1]: https://solana.com/docs/rpc/http/simulatetransaction "Solana RPC: simulateTransaction"
[2]: https://solana.com/docs/rpc/http/sendtransaction "Solana RPC: sendTransaction"
[3]: https://solana.com/docs/rpc/http/getsignaturestatuses "Solana RPC: getSignatureStatuses"
[4]: https://discord.com/developers/docs/interactions/receiving-and-responding "Discord: Receiving and Responding to Interactions"
[5]: https://core.telegram.org/bots/api#setwebhook "Telegram Bot API: setWebhook"
[6]: https://core.telegram.org/bots/webhooks "Telegram: Webhook Guide"

## Open questions and deferred decisions

The user must choose a production hosting/delivery target and provide bot credentials only through a secure secret workflow before live platform integration. Any custody model, wallet bridge, network default, provider/DEX/stake/bet ecosystem, jurisdictional availability, fee model, identity/KYC controls, recipient notification policy, retention period, and production database must be separately approved. This spec does not decide them.
