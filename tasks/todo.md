# Solana Social Wallet Delivery Tasks

- [x] Define and test domain contracts for identities, pairing, recipients, intents, and disabled capabilities.
  - Acceptance: Stable platform IDs, explicit states, validation errors, and no custody fields are encoded.
  - Verify: Focused Vitest domain suite.
- [x] Implement the one-time cross-platform account-pairing vertical slice.
  - Acceptance: Source-bound, hashed, expiring code; only a verified second identity can consume it once.
  - Verify: Tests for success, replay, expiry, source mismatch, and already-linked identity.
- [x] Implement verified recipient resolution and Solana transfer intent creation.
  - Acceptance: Platform-ID resolution and recipient opt-in are required; intent remains awaiting wallet approval.
  - Verify: Tests for opt-out, handle-only refusal, invalid destination/amount, and idempotency.
- [x] Add local Discord/Telegram command-event adapters and deterministic demo.
  - Acceptance: Both adapters use the same shared-account service and cannot call external APIs by default.
  - Verify: Local demo and adapter integration tests.
- [x] Add security documentation, architecture decisions, CI, review, release checks, and controlled GitHub publication.
  - Acceptance: No secrets, live provider, custody, or asset-execution path; source citations and future gates are clear.
  - Verify: Lint, test, build, audit, secret scan, and documented code review.
