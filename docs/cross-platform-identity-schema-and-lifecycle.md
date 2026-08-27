# Cross-Platform Chat Identity Schema and Lifecycle

**Status:** Future persistence specification only.  
**Current implementation:** Credential-free in-memory repository; no database, migration, platform account, or webhook receiver exists in this repository.

## Design boundary

The durable store represents a **shared social account space**, not a wallet, a payment address book, an authorization source for financial actions, or a copy of a chat/social graph. A platform identity is identified by the platform-native user identifier, never by display name, handle, avatar, or membership metadata. Discord documents the user `id` separately and states that `username` is not unique. [1] Telegram’s Bot API describes `User` IDs as numbers that can exceed 32 significant bits, so a future schema stores native identifiers as strings rather than JavaScript numbers or narrow integer columns. [2]

The schema must not store wallet private keys, seed phrases, recovery words, bot tokens, webhook secrets, OAuth tokens, raw wallet-control proofs/signatures, transaction signatures, chat content, contact lists, social graph exports, or full inbound platform payloads.

## Durable entity model

| Entity | Purpose | Prohibited content |
|---|---|---|
| `shared_accounts` | Opaque user-owned account-space lifecycle | Passwords, wallet custody material, messages |
| `platform_identities` | Stable platform identity and constrained profile metadata | Handle as an authority, raw payloads, unrelated PII |
| `identity_bindings` | Time-bounded relationship between a platform identity and a shared account | Implicit/username-based links |
| `pairing_codes` | Hashed, platform-targeted, short-lived pairing initiation | Plain pairing code |
| `pairing_requests` | Source-confirmed link attempt with immutable target identity claim | Session tokens, reusable consent |
| `identity_events` | Append-only security/audit event chain using minimal opaque references | Raw request body, secrets, message text |
| `platform_event_receipts` | Idempotency/replay record for verified inbound platform events | Full platform event payload beyond retention window |
| `identity_recovery_cases` | Controlled, time-locked resolution for conflict/lost-access scenarios | Recovery phrases, broad administrator override |

## Proposed relational schema

The following is a **design schema**, not an executable migration. It assumes PostgreSQL-style syntax and uses expand/contract-compatible tables. A real deployment must choose a supported database, privacy model, encryption/key rotation design, and migration review process before implementation.

```sql
create table shared_accounts (
  id uuid primary key,
  lifecycle_state text not null check (lifecycle_state in ('ACTIVE', 'RECOVERY_LOCKED', 'CLOSED')),
  created_at timestamptz not null,
  closed_at timestamptz null,
  version bigint not null default 1
);

create table platform_identities (
  id uuid primary key,
  platform text not null check (platform in ('discord', 'telegram')),
  subject_digest bytea not null,
  subject_digest_key_version smallint not null,
  subject_ciphertext bytea null,
  subject_ciphertext_key_version smallint null,
  display_label text not null,
  display_label_updated_at timestamptz not null,
  created_at timestamptz not null,
  retired_at timestamptz null,
  version bigint not null default 1,
  unique (platform, subject_digest, subject_digest_key_version)
);

create table identity_bindings (
  id uuid primary key,
  account_id uuid not null references shared_accounts(id),
  identity_id uuid not null references platform_identities(id),
  binding_state text not null check (binding_state in ('ACTIVE', 'UNLINK_REQUESTED', 'UNBINDING_COOLDOWN', 'UNBOUND', 'CONFLICT', 'REVOKED')),
  linked_at timestamptz not null,
  unlinked_at timestamptz null,
  unlink_not_before timestamptz null,
  unlink_reason_code text null,
  version bigint not null default 1
);
create unique index identity_bindings_one_active_identity
  on identity_bindings(identity_id)
  where binding_state in ('ACTIVE', 'UNLINK_REQUESTED', 'UNBINDING_COOLDOWN');
create index identity_bindings_account_active
  on identity_bindings(account_id, linked_at desc)
  where binding_state in ('ACTIVE', 'UNLINK_REQUESTED', 'UNBINDING_COOLDOWN');

create table pairing_codes (
  id uuid primary key,
  account_id uuid not null references shared_accounts(id),
  source_identity_id uuid not null references platform_identities(id),
  code_hash bytea not null unique,
  target_platform text not null check (target_platform in ('discord', 'telegram')),
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null,
  check (expires_at > created_at)
);

create table pairing_requests (
  id uuid primary key,
  account_id uuid not null references shared_accounts(id),
  source_identity_id uuid not null references platform_identities(id),
  target_platform text not null check (target_platform in ('discord', 'telegram')),
  target_subject_digest bytea not null,
  target_subject_digest_key_version smallint not null,
  lifecycle_state text not null check (lifecycle_state in ('AWAITING_SOURCE_CONFIRMATION', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'CONFLICT')),
  code_id uuid not null unique references pairing_codes(id),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  confirmed_at timestamptz null,
  version bigint not null default 1,
  check (expires_at > created_at)
);

create table platform_event_receipts (
  platform text not null check (platform in ('discord', 'telegram')),
  event_id text not null,
  received_at timestamptz not null,
  verified_at timestamptz not null,
  payload_hash bytea not null,
  processing_state text not null check (processing_state in ('RECEIVED', 'APPLIED', 'REJECTED', 'FAILED_PERMANENTLY')),
  primary key (platform, event_id)
);

create table identity_events (
  id uuid primary key,
  account_id uuid null references shared_accounts(id),
  identity_id uuid null references platform_identities(id),
  event_type text not null,
  actor_kind text not null check (actor_kind in ('PLATFORM_IDENTITY', 'USER_CONTROLLED_WALLET', 'SYSTEM_POLICY', 'SECURITY_OPERATOR')),
  correlation_id uuid not null,
  occurred_at timestamptz not null,
  detail_hash bytea not null,
  previous_event_hash bytea null,
  event_hash bytea not null unique
);
```

The `subject_digest` is a deterministic keyed digest used for equality/unique constraints without using a display name as a key. If a future delivery channel requires the raw platform ID, `subject_ciphertext` is isolated, access-controlled, encrypted, and retained only as long as necessary. A migration/key-rotation plan must tolerate multiple digest key versions during reindexing; it must not perform a destructive table rewrite in a live transaction.

## Core invariants and transaction rules

| Invariant | Enforcement |
|---|---|
| A native platform identity has at most one active or pending destructive binding | Partial unique index plus serializable/locked link transaction |
| A code authorizes only a pairing attempt, never a completed link | Store only a hash; atomically consume once; require source identity confirmation |
| Code is target-platform bound and short lived | Check target platform/expiry before atomically consuming it |
| A target identity cannot be substituted after a request is initiated | Bind request to target platform subject digest and reject mismatches |
| Link completion cannot race with another link/unlink | Lock the request, target identity binding rows, and shared account; re-check state/versions inside one transaction |
| Mutable labels have no authorization value | Store as presentation metadata with freshness timestamp; never query/link/pay by label alone |
| Inbound events are at-least-once | Unique `(platform,event_id)` receipt and atomic result transition; Telegram explicitly identifies update IDs as useful for ignoring repeats/out-of-order recovery. [2] |
| Security evidence is append-only and minimal | Hash/redact details, chain event hashes, and enforce a strict retention policy |

## Binding and unbinding state machine

| State | Meaning | Allowed transition | Required authority |
|---|---|---|---|
| `UNBOUND` | Identity has no active shared-account binding | `PAIRING_PENDING` | Verified event from target native identity plus valid target-bound code |
| `PAIRING_PENDING` | Target identity claimed a source-issued code | `BOUND`, `EXPIRED`, `CANCELLED`, `CONFLICT` | Source identity confirms before expiry; system expires/cancels; policy locks conflict |
| `BOUND` | Identity is active on exactly one account | `UNLINK_REQUESTED`, `CONFLICT`, `REVOKED` | Verified bound identity plus step-up policy, or security policy lock |
| `UNLINK_REQUESTED` | A high-impact unlink request exists | `UNBINDING_COOLDOWN`, `BOUND`, `CONFLICT` | Fresh confirmation from a second already bound factor, or approved recovery procedure |
| `UNBINDING_COOLDOWN` | Delayed unlink creates a recovery/cancellation window | `UNBOUND`, `BOUND`, `CONFLICT` | System time transition; cancellation from verified independent factor; security lock on anomaly |
| `CONFLICT` | Competing identity/account/recovery claims or suspicious event | `BOUND`, `UNBOUND`, `REVOKED` | Manual security case with independently verified evidence; no automatic reassignment |
| `REVOKED` | Binding ended due to verified compromise/policy action | `UNBOUND` only through new pairing/recovery process | Security policy and documented recovery case |

The future database stores the corresponding binding row states as `ACTIVE`, `UNLINK_REQUESTED`, `UNBINDING_COOLDOWN`, `UNBOUND`, `CONFLICT`, and `REVOKED`; the `PAIRING_PENDING` state belongs to `pairing_requests` to keep half-created links out of the active-binding relationship.

## Pairing, unlinking, and recovery flows

**Linking** starts only from a verified source platform identity. A short-lived hashed code is issued for the other platform, is atomically consumed by a target native identity, and produces a pending request. The source identity—not a display name or bot command relayed by a third party—confirms the exact target identity before one transaction creates its active binding.

**Unlinking** is security-sensitive because it can remove the factor needed to recover the account. A future implementation must notify every existing bound identity, apply a cooldown, allow cancellation, and require an independent factor for a multi-identity account. The independent factor may be the other bound platform identity or a fresh user-controlled wallet proof that is expressly designed for account recovery; it may never be the bot’s memory of a previous chat message. A single-identity account requires a stricter recovery policy and may be held in `RECOVERY_LOCKED` rather than silently unbound.

**Conflict resolution** is intentionally slow. A collision, simultaneous pairing, contradictory platform event, suspected account takeover, or recovery dispute produces a `CONFLICT` record that blocks transfers, route review, portfolio delivery, and financial capability transitions. Security staff cannot merely reassign an identity by administrative preference; a recovery case must include policy-defined independent evidence, cooldown, notifications, event-chain evidence, and documented outcome.

## Migration, retention, and operations gates

Move from the in-memory adapter only through additive `expand → backfill → dual-write → switch read → contract` migrations. Schema changes must preserve replay/idempotency history, test the unique/foreign-key/check constraints, and offer a reviewed rollback or explicitly documented recovery plan. No real data should be seeded in this repository.

Retention is minimal: expired pairing codes and requests are purged or cryptographically erased after the fraud/incident review window; inbound event payloads are not retained after a verified hash/receipt is produced; profile labels have a short freshness window; and audit events contain opaque IDs/reason codes rather than payloads, tokens, chat text, wallet proofs, or transaction details. Logs must use an allowlist of event fields and include correlation IDs without introducing user identifiers as metrics labels.

## References

[1]: https://docs.discord.com/developers/resources/user "Discord Developer Documentation — User Resource"
[2]: https://core.telegram.org/bots/api "Telegram Bot API"
