# Solana Transaction Fee and Priority-Fee Policy

**Status:** Architecture and pure recommendation policy only.  
**Scope:** A future client-side or independently reviewed service may calculate a bounded fee recommendation for a fully decoded transaction message.  
**Not in scope:** RPC access, automatic fee selection, transaction mutation, signing, submission, or an inclusion/cost guarantee.

## Policy position

A “gas optimizer” is a misleading term if it implies certainty. On Solana, priority fees can increase scheduling likelihood but cannot guarantee a transaction lands, lands quickly, executes at the quoted economic outcome, or costs less than an arbitrary alternative. The policy therefore produces a **user-review recommendation** or `FEE_POLICY_UNAVAILABLE`; it never creates authority to alter a route or an already reviewed message. Solana separates base fees from optional prioritization fees. For legacy/v0 messages, the published formula derives the prioritization fee from price per compute unit and compute-unit limit; the v1 format, when activated, represents it as an absolute total in the message configuration. [1]

## Inputs and numerical representation

All values arrive as canonical unsigned decimal strings and are converted to `bigint` for evaluation. Inputs are accepted only from a future versioned oracle port that identifies source, observed slot, commitment, collection time, fee units, request scope, and failure domain. Neither `number`, floating-point percentile arithmetic, nor provider-supplied “recommended” labels may determine a fee.

| Input | Required rule | Fail-closed condition |
|---|---|---|
| Compute estimate | Simulation-derived `unitsConsumed`, exact message fingerprint, simulation slot/commitment, and safety-margin policy | No successful matching simulation |
| Compute-unit limit | At least consumed units plus bounded margin; never above user/policy maximum or Solana’s documented transaction cap | Limit absent, below estimate, or above cap |
| Fee observations | At least two fresh normalized observation sets from distinct provider and operational failure domains, or a designated single-source low-risk mode explicitly disabled by default | Fewer than two distinct domains, stale samples, malformed units, or conflicting context |
| User maximum | Explicit maximum priority fee in lamports and maximum compute-unit price (legacy/v0) or maximum absolute priority fee (v1) | Missing, zero where action needs priority, or policy-exceeding recommendation |
| Exact message | Format version, route fingerprint, programs/accounts/effects, compute configuration, and fee payer | Any mutation after recommendation |

## Recommendation algorithm

The v1 policy is reserved behind a feature gate because the official versioned-transaction documentation indicates v1 activation is not yet available on a cluster at the retrieval date. The current policy supports analysis of legacy/v0 evidence only; it rejects unknown format versions. [2]

1. Reject unless the decoded message fingerprint equals the simulation fingerprint and the route-review fingerprint.
2. Reject unless simulation succeeds at the documented commitment and returns positive `unitsConsumed`; a simulation error is never retried by raising the fee.
3. Compute a bounded compute-unit limit using the minimum required fixed margin defined by protocol profile, capped by user maximum and the documented transaction maximum. A request outside those bounds returns `COMPUTE_LIMIT_UNAVAILABLE`.
4. Normalize recent observation values to micro-lamports per compute unit with their source and slot. `getRecentPrioritizationFees` observations are historical samples, and a node’s cache may only retain data from up to 150 blocks; samples outside the policy’s slot/time window are rejected. [3]
5. Reject if source/failure-domain evidence is insufficient or if the selected quantile is not computable over the normalized set. The policy does not invent a fallback price.
6. Select the configured conservative quantile as a recommendation, then clamp it to both the user max unit price and the maximum total priority-fee cap. If clamping would place the recommendation below the bounded minimum, return `FEE_CAP_TOO_LOW` rather than silently exceed user limits.
7. Calculate the legacy/v0 estimated priority fee using integer ceiling arithmetic and show it separately from base fee, rent/ATA funds, and protocol/token-transfer charges. [1]
8. Bind the result to the message fingerprint, exact compute limit, source evidence, expiry, and approval ID. A change in any one field invalidates the recommendation and requires new simulation, review, and approval.

## Fee-recommendation decisions

| Decision | Meaning | Required caller behavior |
|---|---|---|
| `RECOMMENDATION_AVAILABLE` | A cap-respecting proposal exists for one fully decoded, simulated current message | Show it as a selectable recommendation and require fresh human review |
| `FEE_POLICY_UNAVAILABLE` | Evidence is stale, malformed, insufficiently independent, or no allowed format matches | Do not guess or auto-fill a fee |
| `COMPUTE_LIMIT_UNAVAILABLE` | Simulation/margin/cap constraints cannot produce a safe limit | Do not sign or submit |
| `FEE_CAP_TOO_LOW` | A bounded recommendation would exceed the user maximum | Let the user cancel or explicitly reconfigure before a fresh build/review |
| `MESSAGE_OR_ROUTE_STALE` | Fingerprint, route, blockhash, simulation, or fee evidence changed | Restart validation and wallet review |

## Strong prohibitions

The system must not raise fees after a user has reviewed a transaction; set unbounded compute-unit prices or limits; use fee oracle output from one unclassified provider as signing-ready evidence; treat a zero fee sample as network-wide proof that zero is sufficient; conflate fee estimates with final charges; hide a third-party tip, fee recipient, or fee payer; send a second transaction because the first has not yet confirmed; or claim that an RPC acceptance response proves confirmation.

`getFeeForMessage` may return the fee for a specific serialized legacy/v0 message and returns `null` when its blockhash is invalid. It is helpful corroborating evidence, but it cannot price a different message or validate a later substituted blockhash. [4] The submission API returns once an RPC accepts a signed transaction, not when the cluster confirms it. [5]

## Lifecycle binding

Fee recommendation takes place only after full route parsing and pre-signing simulation. If a blockhash expires, Solana exposes blockhash validity as a commitment-scoped check; the client must rebuild, re-simulate, re-estimate, re-render, and ask for a new signature. [6] After user signing, the transaction is immutable. If no status can be obtained, the state is **unknown**, not success, and the user must be shown safe status-check guidance rather than a blind resend.

## References

[1]: https://solana.com/docs/core/fees "Solana — Fees"
[2]: https://solana.com/docs/core/transactions/versioned-transactions "Solana — Versioned Transactions"
[3]: https://solana.com/docs/rpc/http/getrecentprioritizationfees "Solana RPC — getRecentPrioritizationFees"
[4]: https://solana.com/docs/rpc/http/getfeeformessage "Solana RPC — getFeeForMessage"
[5]: https://solana.com/docs/rpc/http/sendtransaction "Solana RPC — sendTransaction"
[6]: https://solana.com/docs/rpc/http/isblockhashvalid "Solana RPC — isBlockhashValid"
