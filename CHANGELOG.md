# Changelog

All notable changes to Solana Social Wallet are documented here. The project is an unaudited, non-custodial architecture and local foundation; version numbers do not indicate real-fund, custody, exchange, gambling, or production deployment readiness.

## [0.2.0] - 2026-08-27

### Added

- A source-cited decentralized social-tipping directory architecture that treats Discord and Telegram handles as discovery hints rather than payment addresses.
- A scoped Tip Card model, canonical recipient wallet-binding statement, threshold platform-control receipt, rotation/revocation lifecycle, and privacy-preserving subject commitment design.
- A multi-replica resolver protocol with membership/root certificates, independent failure-domain thresholds, inclusion/consistency evidence, conflict refusal, safe degradation, and governance/implementation gates.
- A pure, deterministic directory-quorum policy and future resolver interface that return a recipient address only from matching independently verified evidence.
- Four adversarial resolver tests, including single-replica, quorum conflict, invalid threshold, and delimiter-collision refusal.

### Changed

- README, specification, architecture, threat model, QA record, code review, and task queue now document the optional future social-directory boundary and its strict no-raw-handle rule.

### Security

- The resolver policy rejects a zero/single-authority configuration and never selects an address from a single response, raw handle, stale/conflicting bundle, or ambiguous delimiter-joined identity.
- No live directory, record, attester, replica, on-chain anchor, wallet, private key, signature, RPC client, bot credential, or asset transfer was added.

## [0.1.0] - 2026-08-27

### Added

- Credential-free TypeScript foundation for source-confirmed Discord/Telegram pairing, stable-ID recipient routing, and non-custodial Solana transfer intents.
- Disabled-by-default buy, sell, stake, and bet capability contracts.
- Source-cited non-custodial key lifecycle and exact-message signing architecture.
