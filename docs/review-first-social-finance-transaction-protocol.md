# Review-First Social-Finance Transaction Protocol

**Status:** Future-only transaction-approval protocol.  
**Scope:** Separates future token swaps, staking, liquidity, and separately admitted betting-provider actions from the existing native-SOL transfer protocol.  
**Current state:** No request kind in this document is signing-enabled.

## Invariant

The social-bot plane coordinates a request. It never acts as a wallet, a transaction builder, a signing delegate, a fee payer, a quote/route selector, a submission service, or a confirmation authority. A wallet-control proof demonstrates that a user controls an address; it does not permit a transaction. The only authorization that can enable a future value-moving action is a fresh signature by a user-controlled wallet over an exact fully decoded message after the user receives a complete review.

Solana signatures cover the serialized message, which contains the header, account list, recent blockhash, and instructions. The fee payer is the first signer and pays base and priority fees. [1] Any fingerprint change is therefore material and invalidates review.

## Request kinds and signer policy

| Request kind | Current signer policy | Preconditions before any future enablement |
|---|---|---|
| `NATIVE_SOL_TRANSFER_V1` | Narrow existing external-wallet/native-companion exception only | Existing ADR-004/ADR-005 gates |
| `SWAP_ROUTE_REQUEST_V1` | Denied | Reviewed provider/profile, full parser, complete route/ALT expansion, quote/fee/simulation evidence, user exact-message review, separate signer-policy change |
| `STAKE_REQUEST_V1` | Denied | Validator/stake authority effects, withdrawal/redelegation/deactivation model, parsing and simulation gates, separate signer-policy change |
| `LIQUIDITY_POSITION_REQUEST_V1` | Denied | Pool protocol profile, LP/NFT position ownership, price-range/impermanent-loss disclosure, parser and simulation gates, separate signer-policy change |
| `BETTING_PROVIDER_REQUEST_V1` | Denied and capability unavailable | Every technical, jurisdictional, eligibility, user-protection, provider, and market-lifecycle gate in the betting policy |
| `ARBITRARY_MESSAGE` | Denied | Remains denied; a general signing escape hatch is prohibited |

## Approval lifecycle

| State | Entry evidence | Exit rule |
|---|---|---|
| `REQUEST_CAPTURED` | User expressed an action intent with explicit maximums | Route/provider profile is validated or request is refused |
| `EVIDENCE_VALIDATED` | Exact intent, quote/route/package, program profile, mint/account effects, and fee evidence pass pure policy | Build the candidate message only in a future approved client |
| `SIMULATED` | Exact candidate message passed required-commitment simulation, with complete decoded effects and bounded resource/fee evidence | Render review or invalidate on any change |
| `AWAITING_USER_REVIEW` | Immutable review package with message fingerprint and expiry | User cancels or chooses user-controlled wallet approval |
| `AWAITING_USER_SIGNATURE` | Wallet verifies current fingerprint and asks locally | Wallet signs or rejects; the bot does neither |
| `SUBMITTED` | User-controlled client relayed a signed exact message | Poll required cluster commitment; do not claim success |
| `CONFIRMED` / `FINALIZED` | Required status is observed with no error | Move to protocol-specific postcondition/reconciliation only |
| `FAILED` / `EXPIRED` / `CANCELLED` | Error, invalid blockhash, user cancellation, or expired evidence | Start a new request; never mutate/retry the old approval |
| `UNKNOWN` | Submission/status cannot be safely classified | Investigate status without duplicate fund movement; never call it success |

`sendTransaction` returns when an RPC accepts a fully signed transaction for relay, not when the cluster processes or confirms it. The status API may provide processed, confirmed, finalized, error, or no result. [2] [3]

## Simulation, expiry, and retry

The future client must simulate the same fully decoded message at the intended commitment before signature, reject an error, and disclose balance deltas, token deltas, logs, consumed units, fee, loaded ALT addresses, and unknown/partially decoded instructions. Simulation is not a broadcast. [4] A simulation with `replaceRecentBlockhash` is useful to estimate a new lifecycle but is not evidence for a previously signed transaction because it changes the message fingerprint.

Blockhash expiry, changed route/quote, changed ALTs, changed compute/priority-fee configuration, changed provider profile, changed parser result, changed accounts, or a status timeout invalidates the whole review. The user may start a new request; the social bot cannot automatically replace or resend the prior request. `isBlockhashValid` evaluates validity at a chosen commitment and `getFeeForMessage` returns `null` for an invalid blockhash, providing explicit future checks for the invalidation path. [5] [6]

## Human-readable review payload

The review payload uses plain language first and raw decoded detail second. It must list the action type; chain; input/collateral/fee mints; maxima/minima; net expected result where deterministically knowable; all protocol, network, rent/ATA, token-transfer, and priority-fee costs; maximum loss conditions; fee payer; signers; writable accounts; all invoked programs and loaded ALT addresses; transaction/route/fee fingerprints; freshness deadlines; simulation status; known risks; and a compact assertion: **“You are approving this exact message once. Approval does not guarantee confirmation, price, settlement, or payout.”**

## References

[1]: https://solana.com/docs/core/transactions/transaction-structure "Solana — Transaction Structure"
[2]: https://solana.com/docs/rpc/http/sendtransaction "Solana RPC — sendTransaction"
[3]: https://solana.com/docs/rpc/http/getsignaturestatuses "Solana RPC — getSignatureStatuses"
[4]: https://solana.com/docs/rpc/http/simulatetransaction "Solana RPC — simulateTransaction"
[5]: https://solana.com/docs/rpc/http/isblockhashvalid "Solana RPC — isBlockhashvalid"
[6]: https://solana.com/docs/rpc/http/getfeeformessage "Solana RPC — getFeeForMessage"
