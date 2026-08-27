# Social Tipping Directory Implementation Gates

This document is a hard-stop checklist for implementation of the decentralized social tipping directory. The current project contains protocol documents, a pure quorum policy, and deterministic contract tests only. It contains no directory transport, user identity record, social-platform credential, attester key, registry program, resolver endpoint, or transfer pathway.

## Preconditions for a non-production prototype

| Gate | Evidence required before code connects to an external system |
| --- | --- |
| Discovery UX | Platform-specific UX design identifies the only permitted stable-ID inputs: Discord native user selection/mention and a Telegram Tip Card/reply equivalent. Raw handle resolution remains excluded. |
| Data minimization | Privacy review specifies Tip Card delivery, recipient consent, scope reuse, expiry, encryption, data retention, abuse reports, and public-record exposure. |
| Attestation ceremony | Discord/Telegram policy-compatible fresh-control ceremony is documented, with raw ingress validation, nonce lifecycle, replay protection, and no stored raw message content. |
| Operator independence | Candidate attester/replica organizations, cloud/network/administrative failure domains, key management, service-level commitments, and incident contacts are documented. |
| Record format | A maintained canonicalization/signature library and test vectors are selected. Implementers cannot copy the illustrative JSON from design docs as a cryptographic implementation. |
| Governance | Membership genesis, normal key/membership rotation, emergency key removal, threshold parameters, activation delay, audit trail, and dispute procedure are approved. |
| Anchor choice | The product decides whether it needs no anchor, signed roots only, or a separately reviewed Solana program. A PDA/account/authority design and program audit are mandatory for the last option. |

## Preconditions for a live pilot

The live pilot must use a non-custodial external wallet confirmation path. It must not receive recovery material or make the bot a signer. It must ship bounded input/output schemas, response size/time limits, a strict resolver endpoint allowlist selected from a verified membership set, TLS, rate limits, request correlation without sensitive content, per-user/capability abuse limits, privacy-safe logs, monitoring, and a documented operator incident response.

The verifier must independently check canonical bytes, signature validity, membership root, attester/root failure-domain uniqueness, expiry, scope, Tip Card capability, sequence/previous hash, status/revocation, inclusion/consistency proof, and cross-replica identical bundle agreement before it displays a recipient address. One response, majority vote, a public username search, a cached stale address, a valid-but-outdated signature, or a platform display name must not pass.

## Preconditions for public production

| Category | Required evidence |
| --- | --- |
| Cryptography | Independent review of record canonicalization, hash/signature library, attester/root key lifecycle, test vectors, nonce policy, sequence/status semantics, and cryptographic agility/migration plan. |
| Solana | If anchoring on Solana, independently audited program, state-account/PDA/authority tests, immutable authority constraints, root/membership governance, cost/rent model, RPC resilience, and full rollback/deprecation plan. |
| Platform | Current Discord/Telegram terms/API review, verified live webhook testing, replay/deduplication controls, scope/privacy behavior, impersonation testing, and abuse/escalation path. |
| Privacy | Data protection assessment for social-to-wallet linkability, availability/enumeration risks, retention/deletion behavior, access logging, node-disclosure policy, and jurisdictional requirements. |
| Resolver | Independent operator launch review, endpoint/key discovery, health/circuit/rate policies, proof cache bounds, quorum settings, partition/equivocation game days, and safe degraded/unavailable behavior. |
| Wallet UX | Exact-address review, sender intent/signing protocol, simulation/submission/confirmation state separation, recipient revoke/rotation experience, fallback raw-address flow, and testnet manual validation. |
| Governance | Key compromise, attester collusion, operator exit, root fork, platform outage, incident disclosure, audit schedule, decision authority, and service termination plan. |

No public release may claim “decentralized,” “trustless,” “private,” “verified,” or “safe for funds” without evidence corresponding to that precise claim. A transparent multi-replica design reduces a central-directory single point of failure; it does not remove social-platform, wallet, governance, transport, or user-approval risks.
