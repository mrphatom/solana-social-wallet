# Operations and Live-Integration Gates

## Current operating mode

The repository is intentionally **local-only**. `pnpm dev` reports the disabled live-adapter posture and exits; it neither binds a port nor contacts a provider. `pnpm demo` uses an in-memory repository and a fixed local clock to exercise pairing without live identities or credentials. This provides repeatable developer evidence while avoiding an accidental public financial service.

## Deployment decision table

| Decision | Status | Gate to proceed |
| --- | --- | --- |
| Discord bot connection | Not configured. | Owner provides application configuration securely, approves a public endpoint, and validates raw-body Ed25519 request checks, replay controls, rate limits, and production observability. |
| Telegram bot connection | Not configured. | Owner provides bot token and webhook secret securely, approves an HTTPS route, and validates secret header, `update_id` deduplication, rate limits, and production observability. |
| Persistent database | Not configured. | Approved environment, reviewed migration/rollback plan, transactional uniqueness constraints, encrypted backup, retention policy, and restore test. |
| Solana RPC/wallet bridge | Not configured. | Approved network and wallet protocol, separate threat model, preview/simulation/signing/confirmation design, and security review. |
| Swap route/DEX/fee oracle | Not configured. | Named providers and failure-domain evidence, reviewed protocol profile, full transaction/ALT/token-extension parser, matching simulation, fixed user caps, independent review, and explicit user-controlled wallet approval. |
| Portfolio/staking/liquidity provider | Not configured. | Read-only address consent, freshness/commitment/degradation contract, protocol-specific profile, no-recommendation policy, privacy review, and separate state-change approval gates. |
| Betting provider | Not configured and disabled. | A separate provider, technical, jurisdiction/eligibility, consumer-protection, market-lifecycle, oracle/settlement, incident, wallet-review, and security decision. |

## Required runtime signals

A future production service should emit allowlisted structured events such as `platform_event_verified`, `platform_event_rejected`, `pairing_requested`, `pairing_confirmed`, `identity_recovery_locked`, `route_evidence_rejected`, `fee_policy_unavailable`, `parser_profile_mismatch`, `portfolio_snapshot_degraded`, `intent_created`, `intent_rejected`, and `wallet_execution_state_changed`. A correlation ID must link inbound event, persistence attempt, and outbound reply. Never record a raw body, bot token, webhook secret, pairing code, wallet proof, user signature, private key, seed phrase, complete username, full message text, raw transaction bytes, unredacted address, or provider response payload.

| Operational question | Signal | Escalation threshold |
| --- | --- | --- |
| Are platform requests reaching verified adapters? | Rate and rejection reason by provider, with bounded labels. | Unexpected signature/secret rejection increase. |
| Is abuse rising? | Rate-limit events, code request volume, code expiry/replay rate. | Sustained threshold breach or account-link anomaly. |
| Is persistence healthy? | Error rate, p95/p99 transaction latency, idempotency conflict count, queue age. | Elevated error rate, failed migration, backup/restore error, or stuck queue. |
| Are wallet flows safe? | Intent creation/rejection counts and future submitted/confirmed/unknown lifecycle counts. | Unknown/failed execution rise, confirmation lag, or duplicate intent signal. |
| Are route/parser checks failing safely? | Bounded rejection reason by policy/profile version; stale/conflict/unknown effect counts. | Unusual mismatch/unknown-effect rate or a profile/fee-source change. |
| Is an account takeover or social-engineering campaign suspected? | Pairing/unlink/recovery lock and security-report rate, with no raw chat content. | Anomaly threshold, invalid-signature surge, or user safety report. |

## Secret handling

Use a managed secret store or securely injected runtime environment. Do not paste a Discord token, Telegram bot token, webhook secret, private key, recovery phrase, wallet signature, or provider credential into chat, a shell argument, source code, test fixture, issue, pull request, log, URL, screenshot, or `.env.example`. Rotate immediately if any production secret is exposed.

## Incident posture

On suspected account-link, social-engineering, or webhook compromise, stop the relevant live adapter, disable financial coordination, lock affected identities in conflict/recovery state, revoke/rotate the affected provider credentials, preserve only sanitized security evidence, invalidate active pairing and review packages, and inform affected users through a pre-approved communication plan. On a suspected transaction/route/parser/fee issue, disable wallet execution first and retain user-visible state as `UNKNOWN` rather than claiming success or failure without verified evidence. This repository has no live state to revoke.
