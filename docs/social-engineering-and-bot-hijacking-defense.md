# Social Engineering and Bot-Hijacking Defense Strategy

**Status:** Security architecture and implementation gate only.  
**Current implementation:** Local, credential-free command adapters and future-only webhook verification primitives. There is no live bot, webhook, credential, user session, provider adapter, wallet, signer, or financial execution path.

## Security posture

The most probable high-impact failures in a social-wallet product are not limited to private-key theft. Attackers can impersonate support, exploit mutable handles, trick users into signing a substituted transaction, replay or forge bot events, take over a linked chat account, exfiltrate bot credentials, alter provider/routing data, or persuade operators to bypass a control during an “urgent” incident. The defense assumes that every chat message, username, rendered preview, callback/custom ID, platform payload, external provider response, and LLM-generated text is untrusted data.

> **Non-negotiable rule:** Neither an employee, moderator, Discord/Telegram message, support ticket, recovery flow, social identity, wallet-control proof, quote, nor fee recommendation can ask a user-controlled wallet to sign without the user reviewing the exact decoded current message locally.

## Assets and trust boundaries

| Asset | Primary threat | Core defense |
|---|---|---|
| User assets and signing authority | Transaction substitution, fake wallet prompt, misleading account effects | Exact-message parser/simulation/review, local wallet-only signing, no bot custody |
| Shared account and identity bindings | Account takeover, identity reassignment, pairing-code theft | Stable native IDs, hashed target-bound codes, source confirmation, cooldown/conflict state, independent recovery factor |
| Bot credential and application control | Token theft, malicious reconfiguration, rogue webhook | Managed secret store, least privilege, rotation/revocation runbook, production access control, deployment provenance |
| Inbound events | Forged/replayed/out-of-order payload | Raw-body verification, timestamp window, idempotent event receipts, strict schema/size limits, monotonic update handling |
| Route/fee/portfolio data | Provider compromise, stale data, hidden instruction mutation | Independent failure domains, expiry, profile/version allowlists, complete parser, immutable fingerprints, unavailable-by-default |
| Audit and recovery evidence | Leakage or repudiation | Minimal redacted append-only events, correlation IDs, retention limits, controlled investigator access |

## STRIDE threat matrix

| Threat | Abuse case | Preventive control | Detective control | Recovery control |
|---|---|---|---|---|
| Spoofing | A fake “support” account asks for seed words or a signature | Published policy: support never requests secrets; verified in-product notices; use platform-native IDs, not handles | User reports, impersonation monitoring, suspicious-contact telemetry | Freeze financial capability; publish verified warning; rotate/revoke compromised identity/session paths |
| Tampering | A route provider changes output mint, program, fee payer, or compute settings after review | Exact structural fingerprint over decoded message, route and fee evidence; fresh review after any change | Fingerprint mismatch/audit event; parser profile drift alert | Invalidate package; require new route validation/simulation/review; never resend old approval |
| Repudiation | An operator claims a high-risk recovery override was routine | Correlation IDs, append-only minimal security event chain, dual-control high-impact changes | Reconciliation of approval/change receipts | Incident case review with access revocation and transparent user status |
| Information disclosure | A bot leaks wallet/balance/position details in a group or telemetry | Private delivery by default, consent, data minimization, field-allowlisted logs, no raw payloads/tokens/proofs | Data-loss monitoring and log-access audit | Remove exposure, rotate impacted credentials, notify affected users through verified channels |
| Denial of service | Event flood exhausts worker capacity or causes stale quote/portfolio retries | Per-platform/request/identity quotas, payload limits, queue backpressure, bounded retry/DLQ, circuit breakers | Rate/error/queue-age alerts with bounded labels | Degrade to read-only/unavailable; preserve idempotency receipts; do not perform catch-up execution |
| Elevation of privilege | A moderator, provider, or chat session acts as a wallet signer | Deny-by-default capabilities, centralized authorization, separation of bot/admin/wallet roles, hardware/managed controls for service secrets | Sensitive-action audit, role/credential change alert | Revoke role/token, lock affected bindings, require independent re-verification |

## User-facing anti-social-engineering design

Financial prompts must use a restrained, repeatable language that makes impersonation obvious. Every bot UI should remind users that **no legitimate workflow requests seed phrases, private keys, recovery words, remote access, payment to “verify” an account, or signature of a message/transaction that they cannot decode**. This notice is an educational control, not a substitute for transaction parsing.

The bot must never distribute software downloads, shortened/unverified wallet links, QR-based signing prompts, copy/paste transaction blobs, customer-support usernames, unsolicited DMs, or “limited-time” investment/wager language. It must not display private assets, quotes, identity details, or recovery prompts in shared channels. Any request involving a wallet, financial action, pairing/unlinking, or recovery should create a private, time-bound, one-action-only flow with an explicit account/chain/fingerprint and an easy cancellation route.

| Interaction | Safe default | Escalation trigger |
|---|---|---|
| Bot command from a group | Generic help; no account/portfolio/transaction detail | Ask user to initiate a verified private session |
| Pairing code request | Source-bound, target-platform-bound, hashed, short expiry, visible confirmation on source platform | Unexpected target, rapid retries, source/target mismatch, takeover report |
| Address or Tip Card discovery | Display as discovery evidence only; require verified target, recipient consent, and fresh user wallet review | Handle-only lookup, conflict/quorum failure, address changes |
| Swap/stake/liquidity/bet request | Capability unavailable or education-only; no auto-routed action | Any live request until protocol/provider/signer gates are independently approved |
| Support or recovery claim | Route only to verified documented support path; never request secrets in chat | Urgency, credential request, impersonating display name, out-of-band payment/signature demand |

## Bot, webhook, and supply-chain hardening

Discord’s HTTP interaction endpoint requires validation of `X-Signature-Ed25519` and `X-Signature-Timestamp` on every request; Discord may test endpoints with invalid signatures. [1] Telegram webhooks can include a configured secret-token header, and Telegram retries non-2xx deliveries; its update IDs also support deduplication/order recovery. [2] The future production design must therefore preserve raw request bytes for verification only, enforce a tight timestamp window, reject malformed/unverified events before parsing, and atomically record minimal idempotency receipts before side effects.

The bot token, OAuth credentials, webhook secrets, CI/deployment credentials, and any operational break-glass secret must be scoped, vaulted, access-controlled, rotated, and never exposed to user chat, logs, client bundles, issue trackers, shell history, screenshots, or repository history. The bot must use only the minimum required platform permissions and event types. A separate production deployment identity must have no user-wallet signing path, no ability to interpret a platform event as wallet approval, and no ability to rewrite route/policy profiles without reviewed change control.

Every dependency, generated build artifact, protocol profile, configuration change, and deployment should have provenance review and a rollback. Financial capability remains globally disabled by default and must be protected by a server-side, audited, time-bound kill switch—not merely hidden in user interface code.

## Detection and safe degradation

Security telemetry uses structured, field-allowlisted events with correlation IDs. It records event type, outcome, platform, capability class, policy/profile version, error category, redacted identity/account references, and timing. It must never record secrets, raw event bodies, bot tokens, wallet proofs, signatures, transaction bytes, raw addresses in metrics labels, or chat content.

| Signal | Safe action |
|---|---|
| Invalid signature/header, replay receipt, timestamp violation | Reject event; increment bounded security metric; investigate repeated source pattern |
| Pairing/unlink/recovery anomaly | Lock affected account in `RECOVERY_LOCKED`/`CONFLICT`; notify existing verified factors; disable financial coordination |
| Route/fee/parser/profile mismatch | Invalidate review package; show unavailable; do not rebuild or ask for a signature |
| Provider/RPC disagreement, stale data, high error rate | Degrade snapshot/routing to unavailable; never silently select one source |
| Bot credential/config/deployment change | Require dual review, audit receipt, post-change health check; use immediate credential revocation/roll back on anomaly |
| Confirmed social-engineering report | Lock high-risk actions, preserve minimal evidence, issue verified warning, and guide secure re-verification |

## Incident response and tabletop exercises

The future operations runbook must cover: suspected bot-token theft; forged or replayed webhook flood; social-account takeover; pairing/unlink abuse; malicious provider route; message parser defect; incorrect “confirmed” status; dependency compromise; and a public impersonation campaign. The incident commander must be able to disable all financial coordination without deleting audit evidence or touching user assets.

Conduct tabletop exercises before any pilot. Each scenario must measure detection time, ability to halt request creation, ability to invalidate pending reviews, credential rotation time, user notification accuracy, event-receipt reconciliation, and preservation of the no-custody/no-auto-execution boundary. No exercise should use production user data or real asset movement.

## Release acceptance gate

Before enabling any live platform integration, require independently reviewed ingress verification; secret management and rotation; least-privilege platform permissions; authorization tests; abuse/rate-limit tests; queue/DLQ/idempotency controls; user safety copy; privacy review; redacted structured telemetry; security incident runbooks/tabletops; dependency/SBOM analysis; emergency disable; and an external security assessment proportionate to value at risk. Before any financial action, also require all route/parser/simulation/signer gates from the review-first protocols.

## References

[1]: https://docs.discord.com/developers/interactions/overview "Discord Developer Documentation — Interactions Overview"
[2]: https://core.telegram.org/bots/api "Telegram Bot API"
