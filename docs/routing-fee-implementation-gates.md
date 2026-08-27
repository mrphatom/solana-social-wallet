# Swap Routing and Priority-Fee Implementation Gates

**Status:** Mandatory gate; no gate is currently satisfied by this repository.  
**Applies to:** Any future token-swap route provider, fee oracle, RPC client, DEX protocol profile, wallet integration, transaction parser, transaction builder, signer, relay, or confirmation worker.

## Gate A — scope, ownership, and provider admission

| Required item | Evidence required before implementation |
|---|---|
| Explicit product authorization | Exact supported networks, action classes, risk tiers, caps, user populations, and emergency-disable owner |
| Provider choice | Named provider with reviewed terms, service boundaries, security contact, versioned schema, rate-limit/error behavior, and no hidden key custody |
| Protocol profile | Version-pinned program IDs, instruction schemas, account roles, CPI/effect model, upgrade-authority review, test vectors, and rollback/kill switch |
| Route independence | Documented failure-domain mapping; no claim of independence where vendors, nodes, or infrastructure are shared |
| Data protection | Documented minimal data, retention, deletion, redaction, access control, and no wallet proofs/signatures/secrets in social-bot logs |

## Gate B — full transaction and asset decoding

The implementation must decode the entire exact message, including message format, header-derived signer/writable roles, static accounts, resolved v0 address lookup table accounts, fee payer, recent blockhash, all top-level instructions, full program-specific instruction data, every expected CPI/inner instruction, and all pre/post SOL/token changes. It must reject unknown formats, program IDs, instruction schemas, account roles, Token/Token-2022 program variants, mint extensions, transfer hooks, transfer authorities/delegates, rent/ATA creation, fee recipients, and balance effects.

| Required check | Minimum acceptance criterion |
|---|---|
| Mint facts | Independent mint/decimals/program/extension data bound to the requested in/out assets |
| Token effects | Gross, net, transfer fee, expected min output, and token account owner/mint effects decoded and disclosed |
| Route effects | Every program/account/instruction is allowlisted by the selected protocol profile; opaque instructions are rejected |
| Lookup tables | Fully resolved and structurally compared before review; ALT changes invalidate the review |
| Fee payer and signers | User requested role only; all additional signer/fee payer/authority changes are rejected unless explicitly represented in the review contract |
| Arithmetic | All units represented as integers (`bigint`) with tested overflow/negative/zero/rounding guards |

## Gate C — simulation and fee evidence

Simulation must use the candidate **exact message** and required commitment. A changed blockhash, priority fee, compute configuration, route, ALT expansion, quote, parser outcome, or balance effect produces a new message fingerprint and requires a complete new review. Simulation does not broadcast. [1]

The priority-fee recommendation must have bounded observations, at least two reviewed failure domains for the signing-ready mode, an explicit age/slot window, known units, tested quantile calculation, a simulation-derived compute estimate plus capped safety margin, and separate maximum user caps for unit price and total lamports. The policy must return unavailable instead of guessing. `getRecentPrioritizationFees` returns slot-indexed historical observations whose node cache can cover up to 150 blocks. [2]

## Gate D — user-controlled approval and operational safeguards

The wallet must show the exact action, input/output assets, max input, min net output, price impact, all fees/rent/ATA funding, fee payer, transfer authorities, every program, all writable accounts, potential transfer-hook effects, message fingerprint, quote/blockhash/approval expiry, simulation outcome, and known risks. User signing must remain local to the selected wallet or native companion. The bot/service must remain unable to sign or use wallet control proofs as a payment credential.

Submission uses the user-controlled client and must retain distinct signed, submitted, processed, confirmed, finalized, failed, expired, cancelled, and unknown states. An RPC success response means relay acceptance, not confirmation. [3] Retry logic must be user-initiated and idempotency-scoped; it must never submit a rebuilt, fee-raised, or route-substituted message based on an old approval.

## Gate E — assurance and release

Before a pilot, require a dedicated threat model, authoritative-source refresh, parser differential tests, adversarial route/quote/provider fixtures, fuzzing of binary/message decoding, dependency/SBOM review, independent security review, privacy review, incident/runbook exercises, canary environment with non-production assets, rate limiting, structured redacted audit events, kill switch, and a release decision that identifies residual risk.

Before production, add third-party security assessment appropriate to transaction value/risk, ongoing provider/version monitoring, schema change detection, explicit maintenance owners, revalidation on program upgrades, operational SLOs, anomaly detection, safe degradation behavior, and a clear user recovery/support process. No checklist item authorizes automated trading or removes point-of-action wallet consent.

## References

[1]: https://solana.com/docs/rpc/http/simulatetransaction "Solana RPC — simulateTransaction"
[2]: https://solana.com/docs/rpc/http/getrecentprioritizationfees "Solana RPC — getRecentPrioritizationFees"
[3]: https://solana.com/docs/rpc/http/sendtransaction "Solana RPC — sendTransaction"
