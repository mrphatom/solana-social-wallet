# Code Review Record

## Scope

The review covers the initial non-custodial TypeScript foundation through commit `3bd02d4` plus the uncommitted review correction that introduces repository-level pairing finalization. The implementation is assessed against `SPEC.md`, not against provider-grade wallet or bot functionality that has been intentionally deferred.

| Axis | Result | Evidence |
| --- | --- | --- |
| Correctness | Approved with a corrective change applied. | Pairing, recipient, intent, capability, webhook, and local-runtime tests cover 16 deterministic behaviors. A source-confirmed link is now finalized through one repository operation rather than separate confirm/add steps. |
| Readability | Approved. | Domain, application, port, adapter, and test folders separate concerns; types make platform, intent, and response states explicit. |
| Architecture | Approved with a documented limitation. | The ports-and-adapters split keeps chat/provider details outside the domain. The in-memory implementation is intentionally not a production transactional database and is named/documented as such. |
| Security | Approved for local foundation only. | No private-key, signer, RPC, network fetch, live credentials, raw payload logging, or automatic financial action exists. Verification primitives are bounded and tested; production ingress/replay/rate controls remain mandatory. |
| Performance | Approved for local foundation only. | Work is bounded by small in-memory maps and input-size limits. Production persistence, queue behavior, and load performance have not been measured and must be evaluated before deployment. |

## Required correction resolved

The initial pairing completion performed a request-state confirmation and a target identity insert as separate repository calls. A transactional production repository could have failed between those calls and left a confirmed request without an identity, or raced with another identity insertion. The repository port now supplies `finalizePairingRequest`, allowing its implementation to make the target uniqueness check, identity insert, and request confirmation one operation. The local runtime and pairing tests passed after the correction.

## Deliberate limitations

The review does not approve a live bot, a production persistence layer, a wallet ownership proof protocol, transaction execution, or any buy/sell/stake/bet provider. It also does not certify user privacy, legal compliance, gambling compliance, financial suitability, security audit status, operating capacity, or custody readiness.

## Social directory architecture increment

The decentralized social tipping directory review covers the new attestation/resolver protocol documents, future-only resolver port, and pure quorum evaluator. It is assessed as a **design and policy increment**, not a live directory implementation or a claim that social-platform identity is decentralized.

| Axis | Result | Evidence |
| --- | --- | --- |
| Correctness | Approved with a corrective change applied. | Four deterministic resolver tests cover matching independent replicas, single-replica refusal, conflicting quorum refusal, and minimum-threshold refusal. |
| Readability | Approved. | The evidence model, policy input, decision union, and future resolver port use focused names and explicit domain/failure-domain fields. |
| Architecture | Approved. | The pure evaluator remains in `src/domain/`; the future transport contract lives in `src/ports/`; protocol, governance, and deployment gates stay in documentation. No resolver/network code is coupled into bot or intent services. |
| Security | Approved for inert policy only. | The evaluator fails closed for missing verified context, insufficient evidence, configuration below two independent domains, and competing complete quorums. Review found delimiter-joined group keys could merge adversarial field tuples; a red regression test was added and the code now uses structural bundle equality. |
| Performance | Approved for inert policy only. | Evaluation processes only the caller-supplied bounded evidence collection. A live collector still needs hard response-size limits, timeouts, rate limits, pagination discipline, cache bounds, and adversarial load testing. |

The review found no private-material, signing SDK, Solana RPC, HTTP/resolver transport, subprocess, dynamic-code, or live directory operation in the implementation. Production must not rely on the policy evaluator's boolean evidence fields as cryptographic verification: a future adapter must independently validate canonical bytes, signatures, membership roots, and proof objects before producing evidence for the policy.

## v0.3.0 routing, fee, and social-finance architecture increment

The review covers the additive pure policies, future-only evidence ports, source-cited protocol documents, durable identity schema/state-machine proposal, staking/liquidity/portfolio interface proposal, and bot-hijacking defenses prepared for `v0.3.0`. It does **not** approve live financial features, a real database, a transaction parser, a provider integration, custody, staking, liquidity, betting, or production deployment.

| Axis | Result | Evidence |
| --- | --- | --- |
| Correctness | Approved for inert policy scope. | A red-first test sequence was captured. The full suite passes 32 deterministic tests across 11 files. New tests cover stale quote, route/message fingerprint mismatch, input/min-output mismatch, invalid slippage/price impact, single/shared route failure domains, opaque/unallowlisted programs, unknown accounts/extensions/authorities, simulation mismatch, fee-oracle staleness/domain failure, unsupported v1 fee policy, caps, and unavailable betting/social-finance capabilities. |
| Numerical safety | Approved with a documented boundary. | New token amounts, compute units, fee values, slots, and timestamps-as-durations use `bigint` policy fields; quantile selection uses a sorted bigint collection and fee math uses ceiling division. Date parsing remains a JavaScript `Date` concern in a pure policy, so production must use strict canonical timestamp validation rather than treating parser acceptance as cryptographic evidence. |
| Architecture | Approved. | Route, fee, betting, and social-finance availability policies live in `src/domain`; future untrusted-evidence ports live in `src/ports`; no policy imports an SDK, transport, signer, wallet, or application service. Existing native-SOL signer policy remains unchanged and cannot authorize new request kinds. |
| Security | Approved for no-execution scope. | Review confirms policies fail closed and do not guess missing evidence. Structural sets/maps are used for provider/failure-domain grouping rather than delimiter-concatenated composite keys. Docs require full message/ALT/program/mint/extension/effect validation, exact fingerprint review, freshness restart, private delivery, ingress verification, and incident disable controls. Betting is a separate explicit `NOT_AVAILABLE` result. |
| Maintainability and performance | Approved for local policy scope. | Evaluators process only caller-supplied in-memory collections with no I/O. Review rejected claims of production scalability: real providers need hard payload/time bounds, worker idempotency/dead-letter handling, cache limits, parser fuzzing, observability, and adversarial load testing. |

The review also found an ESLint unused-parameter error in the initially added social-finance availability policy. It was corrected by replacing the unused parameter with an explicit exhaustive disabled-capability registry; the full gate passed afterward. The change did not broaden capability behavior.

## Residual limits

The boolean-like evidence fields in the pure models are test inputs, not implemented verifications. A future adapter must independently validate provider provenance, signatures, canonical bytes, account state, token extensions, simulation output, and failure-domain claims before invoking these policies. The pure route policy does not decode an actual serialized transaction; the document set explicitly treats an unimplemented full parser as a mandatory gate. There is no user study, legal/compliance assessment, external security audit, live-provider test, performance benchmark, or transaction test in this release.
