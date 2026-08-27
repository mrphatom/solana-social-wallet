# Implementation Plan

## Slice 1 — Trusted domain contract

Create branded IDs, state unions, validation, and policy contracts for accounts, platform identities, pairing codes, recipients, transfer intents, and unavailable capabilities. Verify with deterministic tests that encode the security invariants.

## Slice 2 — Shared-account pairing service

Add an in-memory repository and application service for account creation, first identity binding, source-bound code issuance, and one-time second-platform code consumption. Verify replay/expiry/ownership refusal before adding recipient flows.

## Slice 3 — Recipient and intent service

Add stable-ID recipient resolution and Solana intent creation. Verify that opt-in is required, display handles cannot resolve an asset recipient, idempotency is enforced, and the intent cannot reach a submitted state.

## Slice 4 — Chat command adapters and local simulation

Add typed Discord/Telegram adapter contracts and local command handlers that produce safe responses. Run a deterministic demo that exercises two linked platform identities without external APIs.

## Slice 5 — Operating documentation and release gate

Add threat model, decision records, operations/deployment gates, configuration template, CI, quality records, code review, and public release evidence. Do not add live bot keys, webhooks, wallet providers, or asset execution.
