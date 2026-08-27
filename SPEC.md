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
| `src/domain/` | Pure domain types, pairing policy, recipient resolution, capability policy, transfer intents, and fail-closed routing/priority-fee/social-finance policies. |
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
| Future social-tip directory | Documented scoped Tip Card, signed-binding, attester, multi-replica/root, and fail-closed quorum contracts; pure policy test only. | Live directory records, global handle lookup, plaintext identity/address anchoring, attester/replica operation, recipient-address release, or decentralized identity claim. |
| Solana transfer intent | Validate base58 address and positive lamports, create recipient-bound `AWAITING_WALLET_APPROVAL` intent. | Key custody, signing, broadcast, settlement, or off-chain ledger credits. |
| Wallet confirmation bridge | Typed approval-request contract for a future trusted wallet companion. | An embedded wallet, bot-held key, hidden signing, or automatic resubmission. |
| Swap route and fee evidence | Pure fail-closed evaluator validates intent-bound quote evidence, independent sources, decoded-message fingerprint, bounded program/mint/extension evidence, current simulation, and fixed fee caps. | DEX/aggregator/RPC/oracle access, route fetch, transaction parser/builder, fee mutation, signing, submission, or token movement. |
| Betting provider | Separate protocol-agnostic `NOT_AVAILABLE` policy. | Provider integration, odds/market data, wager, escrow, settlement, redemption, or compliance claims. |
| Staking/liquidity/portfolio | Typed disabled capability registry and source-cited future request/snapshot interfaces. | Validator/pool selection, advice, indexer/RPC access, delegation, liquidity/reward action, or asset execution. |
| Durable identity lifecycle | Migration-oriented schema/state-machine specification for a future relational repository. | Database provisioning, data migration, account recovery operation, or live identity reassignment. |
| Chat transport | Provider-neutral command/event contracts; local simulation endpoint. | Live webhook registration or message delivery without user-supplied credentials. |

## Safety, authorization, and data boundaries

### Always do

- Validate Discord, Telegram, HTTP, and future provider input at the adapter boundary.
- Require both identity ownership proof and account ownership checks before linking/removing an identity.
- Generate high-entropy one-time pairing codes, persist only a hash, set a short expiration, bind the code to source identity/platform, and invalidate it upon consumption.
- Resolve recipients with stable platform IDs, explicit transfer opt-in, and a linked account/wallet address.
- Treat any future social directory as discovery only: require a verified stable platform context, recipient Tip Card/capability, current wallet binding, recipient consent, independently verified evidence, matching replica quorum, and a full address review before an intent can use its result.
- Treat every route, quote, fee observation, portfolio snapshot, stake/liquidity provider response, and betting-provider profile as untrusted, short-lived evidence rather than payment authority.
- Require a fully decoded, structurally fingerprinted, program/mint/extension/ALT/effect-validated exact message and matching successful simulation before any future user review; reject unknown/opaque instructions and mutable/replayed review packages.
- Keep swaps, staking, liquidity, rewards, portfolio reads, and betting-provider requests as distinct capability/request classes. A policy for one class cannot authorize another.
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
- Treat a single resolver, stale cache, response majority, root checkpoint, attester receipt, or wallet binding signature as sufficient to map a raw social handle to a payout address.
- Auto-approve, auto-sign, auto-submit, retry, or silently replace a financial transaction intent.
- Select a route, priority fee, validator, pool, position, market, or provider for a user; guess a missing fee/route/parser effect; or raise/retry a fee after the user has reviewed a message.
- Pretend an intent is a transfer, a transaction signature is a confirmation, an unavailable provider is working, or a disabled capability is enabled.
- Ship live buy/sell/stake/bet functionality or gambling advice/execution under this foundation.

## Security and transaction model

The pairing flow creates a source-bound, 10-minute one-time code. The second platform identity must present that code in its own chat context; an already linked identity is refused. Recipient lookup takes a **stable platform user ID** obtained by the platform adapter—such as a Discord command’s resolved user—not a user-typed handle. Direct messages can display a safe disambiguation response but cannot create an intent from an unresolved handle.

The future social-tip directory is optional and cannot weaken this rule. It uses a recipient-held Tip Card to compute an opaque, scope-bound subject commitment, a wallet-signed address binding, independent platform-control receipts, append-only replica/root evidence, and a resolver policy that requires multiple distinct failure domains to agree on one complete bundle. No component may convert a raw `@handle` into an address, and no directory result can create a transfer itself. See the [directory design](docs/decentralized-social-tipping-directory.md) and [resolver protocol](docs/social-directory-resolver-protocol.md).

An approved recipient lookup produces a transfer request containing a Solana public address and positive lamport amount. The current service only creates an `AWAITING_WALLET_APPROVAL` intent; it cannot construct a signed transaction without an explicit future wallet-confirmation implementation. A future bridge must use the same simulation/preflight commitment as submission and must separately track submitted, confirmed, failed, and unknown outcomes. Solana documents that simulation does not broadcast, and that `sendTransaction` returning a signature does not guarantee cluster confirmation.[1] [2]

The service intentionally defaults capability contracts for **BUY**, **SELL**, **STAKE**, **BET**, portfolio snapshots, liquid stake, liquidity positions, and reward claims to disabled. Separately added pure policies can accept only a future swap route **for human review**; that result has no signer, transaction, provider, or wallet effect. A provider adapter, protocol profile, full parser, independent evidence, simulation, explicit wallet authorization, and security review remain independent implementation gates.

## Persistence model

The first release supplies an in-memory repository for tests and local demos. A future relational design records a stable platform-ID digest, unique active binding, hashed code, pairing request, idempotent verified event receipt, minimal append-only security event chain, and explicit unlink/recovery conflict states. It preserves active-binding uniqueness in the database—not only in application code—and uses additive expand/backfill/dual-write/contract migrations with a reviewed rollback or recovery plan. No database is provisioned here.

## Testing strategy

Most coverage is deterministic, small tests of domain policies. Small integration tests use the in-memory repository to cover an end-to-end sequence: create account → bind Discord → issue pairing code → consume code in Telegram → opt recipient in → resolve platform-native recipient → create transfer intent. Negative tests cover expired/replayed/cross-account pairing codes, username-only resolution refusal, recipient opt-out, invalid Solana destination, zero/negative amount, duplicate idempotency key, disabled ecosystem capabilities, and prohibited state transitions. New adversarial policies cover stale/mismatched routes, single/shared failure-domain evidence, unknown programs/extensions/account effects, invalid slippage/amount/output, stale/mismatched simulation, fee-observation failures/caps, and permanently unavailable betting/staking/liquidity/portfolio capabilities.

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
