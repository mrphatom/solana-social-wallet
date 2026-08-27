# Threat Model

## Assets and trust boundaries

Solana Social Wallet coordinates social identities and transaction intents. It does not custody assets. The primary assets are the integrity of an account link, recipient eligibility, wallet-account association, intent idempotency/state, platform configuration, and user privacy. Discord/Telegram payloads, future webhook transport, user-entered codes, user-entered addresses, and provider responses are untrusted until verified and validated.

| Boundary | Threat | Current foundation control | Production control required |
| --- | --- | --- | --- |
| Chat identity → account | Spoofed or mistaken account link. | Stable platform ID, source-bound expiring code, code hash, target-platform match, target identity uniqueness, source confirmation. | Verified provider event adapter, durable transactional mutation, rate limit, alerts, account-link notification. |
| Pairing code → request | Code leak/replay or redemption by an unintended target. | One use and 10-minute expiry; redemption creates only a pending request; source identity must confirm. | Single transactional consume/create operation, delivery only in private context, target display context, revocation, event audit. |
| Recipient identity → intent | Username impersonation, recipient opt-out bypass, or wrong recipient. | No raw-handle resolution; stable platform ID; linked wallet plus explicit opt-in required. | Provider-native selector/mention validation, recipient identity confirmation display, notification/acceptance policy. |
| Social identity → directory evidence | Raw-handle enumeration, username collision, platform identity spoofing, wallet-address substitution, stale binding, or cross-scope replay. | No live directory; documented Tip Card, opaque commitment, wallet-binding, scope, expiry, sequence, consent, and full-address-review contract. | Verified in-context platform ceremony, recipient-controlled Tip Cards, canonical signatures, current binding/revocation checks, scope enforcement, no global search, privacy review, and independent audit. |
| Directory evidence → recipient address | Malicious/offline replica, equivocation, attester collusion, root/membership takeover, stale anchor, quorum misconfiguration, or data correlation. | Pure policy requires at least two attester, root, and replica failure domains; one response/misconfiguration fails closed; conflicting quorum bundles stop. | Independently operated nodes/keys, membership governance, signed append-only roots/proofs, optional audited root anchor, bounded caches, conflict monitoring, rate/privacy controls, game days, and incident response. |
| Intent → wallet execution | Surprise sign, double submission, stale blockhash, or false confirmation. | Intent stops at `AWAITING_WALLET_APPROVAL`; no signer/RPC dependency exists. | Wallet-owned preview, fee display, simulation, fresh transaction, explicit signature, idempotency, submission/confirmation separation, explorer link. |
| Wallet key lifecycle → local signer | Seed/recovery exfiltration, weak device storage, recovery phishing, cross-device ciphertext copying, or a bot obtaining a signer handle. | No key, signer, or wallet SDK exists in the bot foundation. | External-wallet default; separate wallet-control proof; native encrypted-envelope/OS-keystore architecture; per-sign user presence; device/recovery/revocation plan; independent review. |
| Approval request → signature | Transaction substitution, arbitrary-message signing, changed accounts/programs/fees, stale intent, or signature replay. | Inert policy contract allows only a user-controlled signer and a current reviewed native-SOL request. | Exact-message fingerprint; local parser/allowlist; single-use approval; fresh blockhash/simulation; local signature check; direct submission; immutable audit state. |
| Public webhook → adapter | Forged request, replay, body mutation, oversized request, or denial of service. | Exact raw-body Discord Ed25519 primitive, Telegram secret comparison primitive, raw-body size guard. | Before-parse verification, timestamp freshness, durable event-ID deduplication, body/parser limits, TLS, rate limits, queue isolation, alerts. |
| Provider credentials | Credential theft or accidental disclosure. | No credentials are loaded or used. `.env` and key containers are ignored. | Managed secret store, least privilege, rotation, access audit, no logs/URLs/commit history exposure. |
| Repository/dependency | Vulnerable or malicious package. | Small dependency set, frozen lockfile, audit gate, standard Node crypto. | Provenance review, scheduled audits, SBOM, CI dependency policy, incident response. |

## STRIDE assessment

| Category | Primary scenario | Mitigation status |
| --- | --- | --- |
| Spoofing | Attacker sends a forged bot payload or attempts to link a victim’s chat identity. | Foundation controls pairing; live webhook authentication/replay controls remain deployment prerequisites. |
| Tampering | Attacker alters recipient, amount, code, or provider payload. | Schemas and stable IDs constrain inputs; a future wallet must show immutable transaction details before signing. |
| Tampering | A compromised bot/API changes a transaction after a user reads its summary. | Future signer independently parses the exact message and rejects a stale/mismatched fingerprint before local signing. |
| Repudiation | A user denies creating an intent or accepting a link. | In-memory test adapter is not an audit system; production needs minimal, privacy-safe append-only events. |
| Information disclosure | Raw messages, pairing codes, credentials, wallet material, or identifiers leak in logs. | No credential integration, body logging, or key handling exists; production logging must remain allowlisted. |
| Denial of service | Repeated webhook or pairing requests exhaust process/storage. | No public ingress is enabled; production needs limits, queues, quotas, and monitoring. |
| Elevation of privilege | One identity confirms another user’s link or reuses an address. | Source-identity authorization and account/wallet uniqueness are enforced; database constraints must preserve it. |

## Non-goals and residual risk

No code can make a user-selected recipient safe if the user approves the wrong person in a future wallet. The project also cannot protect a compromised Discord/Telegram account, compromised device, malicious client, insecure deployment, malicious dependency, wallet bug, or future provider misconduct. These are residual risks that require product policies, operational security, independent review, and user education; they are not solved by the local foundation.

## Security acceptance gate

No live deployment is acceptable until provider ingress authentication, event deduplication, persistent transaction semantics, rate limiting, logs/metrics, secret management, security headers, data retention, backups, incident plan, and independent review are implemented and tested. No asset execution is acceptable until a user-controlled wallet approval flow separately meets simulation, signing, submission, confirmation, and recovery requirements.
