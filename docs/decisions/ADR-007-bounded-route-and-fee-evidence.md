# ADR-007: Treat Routes and Priority Fees as Bounded Evidence, Not Transaction Authority

## Status

Accepted

## Date

2026-08-27

## Context

The project needs a future-safe foundation for token-swap routing, compute-budget settings, and priority-fee recommendations without allowing the Discord/Telegram bot or social-wallet service to become a financial execution component. A candidate route can contain unfamiliar programs, Token-2022 extensions, transfer authorities, fee payers, address lookup tables, writable accounts, token transfer fees, and custom transfer-hook behavior. An opaque provider-built transaction cannot be safely interpreted as a user-approved swap merely because it is syntactically valid.

Solana’s fee model separates a base fee from an optional prioritization fee. For legacy/v0 transactions, the priority fee follows the configured compute-unit price and compute-unit limit, while the documented v1 format changes fee representation. Recent prioritization-fee observations are historical and node-local evidence, not inclusion guarantees. [1] [2] A transaction signature binds the serialized message—including accounts, recent blockhash, and compiled instructions—and the fee payer is the first signer. [3]

## Decision

The project will treat a route and priority-fee recommendation as **bounded, revocable evidence**. Only a separate future user-controlled wallet integration can request a signature, and it may do so only after a full message decoder, independently reviewed protocol profile, route/quote/mint/ALT validation, matching simulation, user-visible fee caps, and fresh exact-message review. The current signer policy stays limited to `NATIVE_SOL_TRANSFER_V1`; all swap, staking, liquidity, and betting-provider request kinds remain denied.

The policy requires structural—not delimiter-joined—identity of route fingerprints, providers, failure domains, instruction effects, and mint extensions. It uses `bigint` for amounts, slots, fees, and compute values. Missing or stale evidence returns an unavailable/review-required decision; no component guesses a fee, substitutes a route, raises a fee, rebuilds a message, or retries a financial action without a new user-controlled review.

Betting-provider requests are strictly separate and disabled pending a protocol-specific provider, technical, consumer-protection, and jurisdiction/eligibility review. The decision does not select a provider, make a legal conclusion, recommend a wager, or implement a financial action.

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Trust an aggregator’s prebuilt transaction after superficial quote checks | A prebuilt message can add programs, fee payers, writable accounts, transfer authorities, or token effects outside the original user request. |
| Let the bot/service optimize or refresh fees until an action succeeds | Fee/routing mutation changes the signed message and risks hidden user-limit changes or repeated financial actions. |
| Use a single fee/route source as authoritative | Provider faults, stale state, and correlated operations can produce a confident but unsafe route. |
| Reuse the native-SOL transfer signer exception for swaps/bets | Swaps and betting-provider actions involve materially broader program, account, token, market, and compliance risk. |
| Add automatic transaction execution before parser/simulation coverage | A parser gap means the client cannot honestly describe what the user would sign. |

## Consequences

The repository adds pure, dependency-free routing and fee-policy evaluators plus unimplemented evidence ports. This increases future implementation work because every protocol profile must supply parser tests, version pinning, program/extension allowlists, and explicit user disclosures. It also preserves a clear audit boundary: **accepted for human review** is not built, signed, submitted, confirmed, settled, or profitable.

The project does not contain an RPC URL, provider configuration, DEX/betting integration, wallet SDK, key, quote, route, transaction, signature, broadcast, or financial execution path.

## References

[1]: https://solana.com/docs/core/fees "Solana — Fees"
[2]: https://solana.com/docs/rpc/http/getrecentprioritizationfees "Solana RPC — getRecentPrioritizationFees"
[3]: https://solana.com/docs/core/transactions/transaction-structure "Solana — Transaction Structure"
