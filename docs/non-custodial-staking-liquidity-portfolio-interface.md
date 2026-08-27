# Non-Custodial Staking, Liquidity, and Portfolio Interface

**Status:** Architecture and inert interface contract only.  
**Current implementation:** No portfolio provider, RPC/indexer, staking protocol, liquidity protocol, wallet, transaction builder, signer, or financial action exists in this repository.

## Product boundary

The Discord/Telegram bot is a **social coordination and notification plane**. It may eventually deep-link or hand off a signed, user-controlled request to a wallet client; it must not custody assets, calculate personal investment advice, recommend validators/pools/positions, create a stake account, delegate, deactivate, withdraw, provide liquidity, remove liquidity, collect rewards, rebalance, sign, submit, or report asset settlement.

Portfolio information, where a user expressly enables it in a future implementation, is a **read-only, source-bound snapshot**. It is not a balance guarantee, a valuation, a real-time statement, or an authorization to act. A bot message must retain source, observed slot/time, commitment/finality, address scope, display-currency source/expiry if any, and explicit stale/unavailable state. No transaction or financial position is sourced from a username/handle alone.

## Capability matrix

| Capability | Current state | Future request shape | Non-custodial rule |
|---|---|---|---|
| Portfolio snapshot | `NOT_AVAILABLE` | `PORTFOLIO_SNAPSHOT_REQUEST_V1` | Read-only evidence only; no action control or automatic refresh without consent |
| Native SOL staking | `NOT_AVAILABLE` | `STAKE_REQUEST_V1` | User wallet alone controls stake/withdraw authority signatures |
| Liquid staking token interaction | `NOT_AVAILABLE` | `LIQUID_STAKE_REQUEST_V1` | Treated as a protocol/token transaction, not as native delegation |
| Liquidity position | `NOT_AVAILABLE` | `LIQUIDITY_POSITION_REQUEST_V1` | Each pool protocol has its own account, token, price-range, and withdrawal-risk profile |
| Rewards/claims | `NOT_AVAILABLE` | `REWARD_CLAIM_REQUEST_V1` | A reward label is insufficient; the full exact transaction must be decoded/reviewed |
| Validator/pool selection | `NOT_AVAILABLE` | No autonomous request | The system may display source-attributed facts but may not recommend, rank, or auto-select |

## Staking interface

Solana stake accounts are distinct from ordinary system accounts and have separate stake and withdraw authorities. The withdraw authority can withdraw undelegated stake and change authorities, so it requires especially prominent review. A stake account can delegate to only one validator at a time; changes take time and lockups can restrict withdrawal. [1] The user interface must expose these facts without claiming a particular validator is appropriate or a reward is predictable. Solana’s own staking reference does not recommend a particular validator. [2]

| Interface surface | Required disclosure | Prohibited behavior |
|---|---|---|
| Read-only stake card | Stake-account address, observed balance, validator vote address/identity label source, activation state, authority relationship, lockup, source time/slot/commitment | “Available balance” when funds are activating/deactivating/locked; reward forecast/recommendation |
| Delegate request preview | Funding source, new stake account (if any), exact validator identity, stake/withdraw/lockup authorities, fee payer, rent, expected lifecycle delay, transaction fingerprint | Delegating from a bot command or a remembered user preference |
| Deactivate preview | Exact stake account, current state, authority, earliest non-guaranteed availability condition, fee, fingerprint | Calling funds withdrawable immediately |
| Withdraw preview | Deactivated/lockup evidence, destination classification, withdraw authority, amount, account-close outcome, fee | Auto-withdrawal when a state appears inactive |
| Split/merge/authority change | All source/destination accounts, matching prerequisites, all resulting authority/lockup state, account effects | Generic “manage stake” action without a protocol-specific decoder |

## Liquidity-position interface

Liquidity is protocol-specific. The same label can conceal different risk/effect models: two-asset pools, concentrated price ranges, single-sided deposits, LP tokens, non-fungible position accounts, reward programs, protocol-controlled vaults, transfer-hook tokens, variable fees, or withdrawal/claim instructions. A generic liquidity button is prohibited.

Every future `LIQUIDITY_POSITION_REQUEST_V1` requires an independently reviewed **pool protocol profile** covering program IDs and upgrade authority, instruction schemas, vault/position derivations, token mints and Token/Token-2022 extensions, concentration/range/rate fields, fee recipient, price/oracle context, expected tokens in/out, possible position tokens/NFTs, and all close/remove/claim effects. The secure parsing/simulation protocol applies in full.

| Read-only position view | Review-first add/remove/claim request |
|---|---|
| Protocol profile version and source | Exact pool/position identifiers and program IDs |
| Position ownership evidence, token mints, raw amounts, source slot/commitment | Exact input/output min/max amounts, range/price parameters, fees, slippage, and expiry |
| Degraded/stale/no-data distinction | All signer/writable accounts, ATAs/rent, transfer fees/hooks, vault/recipient effects |
| No yield/APR or “safe” label absent a separately approved methodology | Full parser and simulation evidence, current fingerprint, local wallet approval |

The system must say **“position valuation unavailable”** whenever token price, token decimal, pool-state, oracle, or account evidence is stale, conflicting, unverified, or outside the profile. It may never substitute a cached value for a withdrawal minimum or an actual wallet review.

## Portfolio-snapshot interface

The future port returns `PortfolioSnapshotEvidence`, not a portfolio “truth.” Each row is independently scoped to one public address and annotated with its source. It carries only public-address data and excludes private key material, wallet-control proofs, signatures, session tokens, or unredacted bot event payloads.

```text
PortfolioSnapshotEvidence
  snapshotId, subjectAccountId, addressScopeDigest
  sourceId, sourceFailureDomain, observedAt, observedSlot, commitment
  status: AVAILABLE | STALE | PARTIAL | UNAVAILABLE | CONFLICT
  nativeBalanceBaseUnits, tokenHoldings[], stakeAccounts[], liquidityPositions[]
  parserProfileVersions[], valuationEvidence? (optional, source-bound)
```

Only `AVAILABLE` records with fresh, consistent evidence may appear as a completed snapshot. `STALE`, `PARTIAL`, `UNAVAILABLE`, and `CONFLICT` are first-class outcomes. No portfolio notification prompts a financial action; its only permitted navigational action is “view source details” or “open user-controlled wallet,” neither of which transfers a financial intent automatically.

## Chat-specific safety controls

Financial state must default to private delivery. Group-channel responses show generic guidance only; no wallet address, balance, stake account, position, quote, or action detail appears in a public reply. A bot must require a verified stable platform ID plus explicit session-scoped consent before returning any user-linked snapshot. A social identity change, recovery lock, compromised-session event, consent expiry, or source conflict invalidates portfolio delivery until reverified.

The interface must rate-limit snapshots, coalesce identical requests, and preserve separate read, review, approval, signature, submission, and confirmation states. Background refresh, event processing, and notifications are future asynchronous work that require idempotent event receipts, bounded retries, dead-letter handling, redacted audit events, and a user-controlled disable switch.

## Implementation gates

Before a prototype, require named data providers and terms, a public-address consent model, freshness/commitment policy, provider-failure model, portfolio API/schema validation, rate-limit and cache design, per-protocol parsing profiles, privacy review, threat model, and tests for stale/partial/conflicting data.

Before any state-changing action, additionally require full exact-message parser/simulation coverage, protocol-specific security review, signer-policy amendment, user wallet flow, action-specific disclosure, liability/consumer-protection review, incident controls, emergency disable, and a separately authorized point-of-action release. None of these gates allows a chat bot to sign, custody, or execute.

## References

[1]: https://solana.com/docs/references/staking/stake-accounts "Solana — Stake Accounts"
[2]: https://solana.com/docs/references/staking "Solana — Staking"
