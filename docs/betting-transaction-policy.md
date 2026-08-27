# Betting-Provider Transaction Policy

**Status:** Disabled capability and architecture boundary.  
**Scope:** Future protocol-agnostic betting or prediction-market request handling.  
**Current availability:** `NOT_AVAILABLE`.

## Separation from token swaps

Betting is not a swap route with different labels. A bet, prediction-market order, pooled wager, or similar instrument may introduce jurisdiction, age/eligibility, geolocation, identity verification, market rules, oracle, settlement, redemption, custody, consumer-protection, and dispute-resolution concerns that cannot be inferred from a Solana transaction alone. This repository therefore models it as a separate request class and maintains a deny-by-default capability state.

No Discord/Telegram command, bot interaction, social identity binding, directory record, quote result, fee suggestion, or wallet-control proof may authorize, create, submit, settle, redeem, or advertise a wager. This policy does not recommend a market, odds, stake size, provider, jurisdiction, or legal outcome.

## Admission gate

A concrete betting-provider adapter is prohibited until a separate security/compliance decision record and implementation gate document all fields below. A missing, stale, conflicting, or unverifiable field keeps the capability disabled.

| Gate | Required evidence | Why it is distinct from swap routing |
|---|---|---|
| Provider and protocol profile | Legal entity, intended product type, independently reviewed program IDs/instruction schemas, upgrade authority policy, and incident contact | “Betting” has no universal instruction or safety model |
| Jurisdiction and eligibility | Explicit supported locations, minimum-age policy, eligibility assessment, restriction handling, and user-notice flow reviewed through appropriate professional channels | Location and eligibility may determine whether access is available |
| Market lifecycle | Market creation, pause/cancel/void, oracle/data source, dispute, settlement, redemption, expiry, and abandoned-position rules | A transaction can succeed while the underlying market remains unsettled or disputed |
| Economic disclosure | Exact maximum amount at risk, collateral asset/mint, protocol fee, recipient/escrow accounts, loss conditions, and withdrawal/redemption constraints | “Minimum output” does not represent a wager’s contingent outcome |
| Authority and custody | User controls wager funding and any redemption signature; escrow/PDA/program authority paths are decoded, allowlisted, and independently reviewed | A protocol authority can control collateral outcomes even where the bot has no keys |
| Fairness and operations | Market-integrity/abuse response, oracle failure handling, sanctions/restricted-party handling where applicable, complaint path, and change-management controls | Technical validity does not establish fair or lawful operation |

## Request contract and policy outcome

The future `BETTING_PROVIDER_REQUEST_V1` contract may record an **untrusted discovery request**, but current `evaluateBettingCapability()` always returns `NOT_AVAILABLE` with `PROTOCOL_COMPLIANCE_AND_PROTECTION_REVIEW_REQUIRED`. It must not expose a wallet-signable message field, a provider endpoint, a funding route, odds, recommendation, or an execution method.

Even if a future provider is admitted, its request must be separately parsed into a human-readable risk disclosure and exact account/instruction effect model. The display must state collateral mint, maximum loss, protocol/escrow recipient, fee payer, all signers, program IDs, settlement/redeem conditions, cancellation/void conditions, provider/market freshness, and the full transaction fingerprint. Any parser gap or unknown program/account/CPI effect is a hard refusal.

## Approval and state rules

| State | Meaning | Bot/service behavior |
|---|---|---|
| `NOT_AVAILABLE` | No approved provider/compliance/protection profile exists | Show the capability as unavailable; do not collect an intent that resembles an order |
| `DISCOVERY_ONLY` | A future user asks to inspect a provider profile without creating a transaction | Return education/risk disclosures only; no quote, route, or wallet request |
| `REVIEW_REQUIRED` | A future concrete provider package has passed technical admission but awaits user’s exact message review | Preserve immutable evidence; no bot-side funding/action |
| `AWAITING_USER_SIGNATURE` | A user-controlled wallet has rendered the final current message | The bot may display status only; it cannot sign or resubmit |
| `SUBMITTED` | A signed message was relayed by the user-controlled client | Never call this settled or placed until the chosen status and protocol lifecycle conditions are met |
| `UNKNOWN` | Status or provider lifecycle cannot be verified | Refuse “success” claims; provide safe retry/status guidance rather than funding again |

A Solana transaction is a set of signed message instructions/accounts that executes atomically only if all instructions succeed. The existence of a valid on-chain transaction does not establish downstream market resolution, payout eligibility, or user comprehension. [1]

## Non-negotiable safety rules

The bot must not use betting to bypass disabled swapping, obtain a route from a provider and attach it to a broad wallet approval, prefill or automatically increase stake/fees, let a platform identity substitute wallet ownership, reuse an expired review, or act on a presumed status. A provider account/program that is not in a reviewed allowlist is unknown, even if a provider advertises it as official.

## References

[1]: https://solana.com/docs/core/transactions/transaction-structure "Solana — Transaction Structure"
