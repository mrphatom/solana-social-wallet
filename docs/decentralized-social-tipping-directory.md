# Decentralized Social Tipping Directory Architecture

## Objective and hard limits

This architecture allows a Solana Social Wallet user to discover a recipient through Discord or Telegram without a single central database deciding where funds go. It does **not** make Discord or Telegram decentralized; both platforms still control their user identities and availability. It also does not make a display name a cryptographic address, remove the need for an exact-address review, or authorize an asset transfer.

> **Directory rule:** A Discord/Telegram handle is a discovery hint. A recipient can be resolved for a tip only after a platform-native stable ID, an active recipient opt-in, a current wallet-controlled address attestation, an expiry/revocation check, a multi-replica verification policy, and a sender-facing full-address review all succeed. Otherwise, the result is unavailable—not guessed.

Discord documents that a `username` is not unique across the platform, while its `id` field is the user identifier.[1] Telegram Bot API updates carry a `User` object, but its update and webhook delivery model still requires verified adapter processing and replay control.[2] The system therefore uses those platform subject IDs only after a recipient has selected a platform-native identity in an authorized chat context; it does not globally search raw `@handles` to find a payout address.

The design is **federated-verifiable**, not magically trustless. It removes a single central directory database as the exclusive availability and address-authority point by using independently operated replicas, user-signed records, threshold attester receipts, and an optional Solana-anchored root. It cannot remove the identity platforms, a future Solana program's governance, or the user's need to inspect the final address.

## User experience

| Platform | Safe discovery input | What the sender sees | What is never accepted |
| --- | --- | --- | --- |
| Discord | Native user mention or user-select component from the current allowed community/DM context. | Verified display label, platform badge, recipient's short address, registry freshness, and a **View full address** step. | A typed username, nickname, global display name, or copied text as a payment target. |
| Telegram | A recipient-created Tip Card, a user-reply/forward flow that yields a verified `from.id`, or a platform capability with explicit stable-user metadata. | The Tip Card recipient label, verified platform identity marker, current address preview, expiry, and **View full address**. | A raw `@username`, a display name, an unverified forwarded message, or free-text profile search as an address lookup. |
| Cross-platform | A linked user can publish a scoped Tip Card that contains an opaque directory capability, not their address. | Recipient's explicit opt-in and the associated platform proof paths. | Inferring Discord ↔ Telegram ownership from similar names, avatars, contacts, or public addresses. |

The sender first selects a platform-native recipient. The client constructs a scoped, ephemeral **discovery request** and asks multiple directory resolvers for a valid resolution bundle. It then shows a recipient label and the full Solana address. Selecting **Create tip intent** copies the verified address into the existing recipient-bound, non-custodial transfer intent. The future wallet client must still use the exact-address review and exact-message signing protocol; it must never sign a “tip to `@name`” summary.

## System roles and trust zones

| Role | Minimum number | Authority | Cannot do |
| --- | --- | --- | --- |
| Recipient wallet | One user-controlled Solana wallet. | Sign a binding, rotation, or revocation for its own address. | Prove a Discord/Telegram identity by itself; sign a sender's transaction. |
| Platform attester | Threshold `t` of independently operated verifiers from current membership set `N`. | Validate a recipient's live platform-control ceremony and co-sign a narrow attestation. | Select a wallet address without a valid recipient wallet signature; move funds. |
| Directory replica | At least three independent operators for public operation. | Store/serve signed attestations and signed log roots. | Modify a valid signed record or override the wallet-controlled sequence. |
| Root anchor | Solana program-owned registry or multi-operator signed checkpoint. | Publish a membership-set hash and root quorum certificate. | Hold user keys or make a payment. |
| Resolver client | Sender's wallet client or approved bot companion. | Fetch multiple proofs, verify signatures, apply policy, and show the address. | Treat one unverified response or a handle string as a destination. |
| Social bot | Transport/UI only. | Obtain a platform-native identity from a verified event and request resolution. | Custody a key, decide trust alone, or substitute an address. |

An attester and a replica may be operated by the same organization only if they are counted as one failure domain. Production membership must identify organization, network/operator, key, endpoint, key validity period, jurisdiction/operating policy, and revocation route. Three cloud deployments under one administrator are not three independent replicas.

## Record classes

The directory uses ordinary, versioned signed documents. It may later serialize those documents as Verifiable Credentials, but must not claim W3C VC or DID interoperability unless it conforms to a selected securing mechanism and method. W3C distinguishes a credential's cryptographic authenticity/currency from whether its claims meet a verifier's reliance policy; resolvers must apply both checks.[3]

All signed JSON uses **RFC 8785 JSON Canonicalization Scheme (JCS)** with an explicit `canonicalization` field, UTF-8 bytes, no duplicate keys, and string encodings for lamports, sequence values, and timestamps outside safe JSON number bounds. RFC 8785 defines deterministic serialization precisely so hashing/signature inputs are repeatable, and says a verifier must parse, validate, canonicalize, then verify or abort.[4]

### 1. Wallet Binding Statement

The recipient's wallet signs this statement through the non-custodial signer architecture. It is not a transaction and contains a plain-language statement that it cannot move funds.

```json
{
  "type": "SSW_SOCIAL_WALLET_BINDING_V1",
  "version": 1,
  "canonicalization": "RFC8785",
  "bindingId": "opaque-128-bit-id",
  "network": "solana:devnet",
  "directoryNamespace": "ssw.social.directory.devnet.v1",
  "subjectCommitment": "sha256:base64url",
  "solanaAddress": "base58-public-address",
  "sequence": "7",
  "issuedAt": "2026-08-27T12:00:00Z",
  "expiresAt": "2026-11-25T12:00:00Z",
  "previousBindingHash": "sha256:base64url-or-null",
  "statement": "Bind this wallet for social tipping discovery. This does not approve a transfer.",
  "signature": "base64url-ed25519"
}
```

`subjectCommitment` does not contain a plaintext handle, social platform ID, chat ID, wallet address, email, phone number, avatar, or global account ID. It is a deterministic commitment to a scoped stable platform identity plus a recipient-controlled opaque discovery secret. The secret is only released in a Tip Card or an authorized native recipient-selection exchange. A public, unsalted hash of a known Discord/Telegram ID is insufficient because it permits inexpensive enumeration and cross-context correlation.

### 2. Platform-Control Attestation

Each independent attester verifies a recipient's fresh in-platform ceremony and signs an assertion that is intentionally narrow: a particular platform-native subject ID, scope, subject commitment, binding hash, attester key ID, issue/expiry time, and attestation nonce. It contains no plaintext handle or wallet address. The attester must validate the raw platform event/signature with its own configured platform adapter before creating an assertion; it must reject replayed ceremony nonces, untrusted chat context, stale request, target mismatch, or missing user consent.

```text
Attested claim:
  platform + stablePlatformUserId + permittedScope
       controls subjectCommitment
       for bindingHash
       until expiresAt
```

Independent attesters use different application credentials, deployment operators, and signing keys. Where platform terms or technical capability prevent independent verification, the resolver must label that platform as `SINGLE_ATTESTER_LIMITED` and refuse high-value/default automated use. It must not silently call this threshold trust.

### 3. Tip Card

A Tip Card is a recipient-issued, shareable, revocable discovery capability. It contains `tipCardId`, opaque discovery secret, recipient-selected scope, allowed platform(s), expiration, rate/reuse policy, and pointer(s) to replica record identifiers. The card never contains a private key, seed phrase, signature authorization, signed transaction, wallet-control session, final recipient address, or plaintext social identifier.

For group/community use, the preferred discovery input is a recipient mention/user-select plus an opt-in Tip Card. In a direct message, a user can share a Tip Card through the same channel. A raw handle can open a **non-financial request** asking the recipient to issue a Tip Card; it must not produce an address response.

### 4. Rotation and Revocation Statements

A current wallet can rotate a binding by issuing the next sequence with both old-address and new-address signatures plus fresh platform-attester receipts. A current wallet can revoke immediately with a monotonically increasing sequence and reason class `USER_REQUEST`, `COMPROMISE_SUSPECTED`, or `DEVICE_LOST`. Revocation removes the binding from resolver acceptance even if replicas still serve historical records.

If the wallet is compromised or unavailable, a social-account recovery flow may only **suspend** discovery/tipping. It must never rotate an address, restore key authority, or select a replacement wallet from social identity alone. Resuming from suspension requires a new user-controlled wallet binding and threshold platform re-attestation.

## Record lifecycle

```text
platform selection + recipient consent
        │
        ▼
opaque discovery secret + scoped subject commitment
        │
        ▼
wallet signs binding statement ──► t independent attesters verify platform control
        │                                     │
        └─────────────────────────────────────┘
                            │
                            ▼
      signed binding bundle replicated to independent directory nodes
                            │
                            ▼
         replicas append hash to local log → agree root quorum certificate
                            │
                            ▼
       optional Solana root anchor (membership + log-root commitment)
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
       resolve valid     rotate with     revoke/suspend
       current bundle    next sequence   blocks new resolution
```

The optional Solana root anchor commits a root hash and membership-set hash rather than each recipient's social identity/address record. Solana accounts are program-owned state, and only the owner program can modify their data; a purpose-built program would need explicit authority, PDA domain separation, and independent audit.[5] [6] The anchor increases tamper evidence and independent retrieval, but it cannot prove the truth of a Discord/Telegram claim, provide content availability, or protect privacy by itself.

## Decentralized resolver protocol

### Resolution request

The social bot obtains a verified stable platform ID only from a platform-native selection/reply flow. It combines that ID with the Tip Card discovery secret to produce the subject commitment locally, then sends the commitment and the card's allowed scope to a rotating resolver set. The request includes a random request nonce, directory/network version, minimum root freshness, and a per-recipient caller authorization token. It contains no sender wallet address, requested amount, transaction ID, raw chat message, or plaintext username.

Each resolver returns either a bounded `NO_CURRENT_BINDING` result or a **resolution bundle**: current binding statement, threshold attester receipts, current revocation/suspension status proof, replica log inclusion proof, root quorum certificate, membership set, anchor reference if configured, and untrusted display metadata. All external records are schema-validated before use.

### Resolver acceptance policy

The client accepts a recipient result only when all controls below pass. Availability never overrides integrity: one valid result may be shown as *unconfirmed discovery*, but it cannot populate a payment intent.

| Control | Initial production policy | Failure behavior |
| --- | --- | --- |
| Stable recipient selection | Verified Discord user ID or verified Telegram user/Tip Card flow in current allowed scope. | Ask recipient to share/tap a Tip Card or use native selection; no address. |
| Binding signature | Ed25519 signature verifies against the recorded Solana address over canonical statement bytes. | Reject record. |
| Binding freshness | `issuedAt`, `expiresAt`, maximum age, namespace, network, and sequence are current. | Reject record; ask recipient to renew. |
| Platform attestation | At least `t = 2` valid receipts from distinct attester failure domains, or policy-labeled limited mode. | Reject for standard tipping; no degraded automatic payout. |
| Revocation | Current root proves no newer revocation/suspension/rotation sequence. | Return unavailable. |
| Replica agreement | At least `q = 2` independent replicas return the same binding hash and root quorum certificate. | Return conflict/unavailable; never choose a majority address blindly. |
| Root freshness | Root age is within product policy and anchored/threshold-signed by current membership. | Return stale/unavailable; no cached address payout. |
| Recipient scope | Tip Card, platform, community/DM scope, and opt-in allow this lookup. | Return unavailable without revealing directory membership. |
| Sender review | Full base58 address and social recipient context shown before intent creation. | Cancel without intent. |

For a public v1 configuration, the membership set could contain `N=5` named independent resolver/attester organizations, root checkpoints require `3-of-5` signatures, and the wallet client requires matching responses from two independent replicas plus inclusion in a 3-of-5 root. Those numbers are **initial policy examples**, not a cryptographic guarantee. They must be stress-tested against operator independence, collusion, compromise, latency, platform access, and governance before deployment.

### Forks, equivocation, and outages

If a resolver returns a different valid-looking binding/root from another, the client emits `DIRECTORY_CONFLICT` and stops. It retains hash evidence locally/audits it without exposing recipient data, and can request an out-of-band root comparison. It must not pick the address with more responses, the newest clock time, the most convenient endpoint, or the first answer.

If the root-anchor chain/RPC is unavailable, the client can verify a threshold-signed root certificate only if the membership set is already verified/cached, the root is within a short freshness window, and the product policy explicitly permits degraded read availability. It may never create/rotate/revoke a binding while anchor authority is unknown. If replicas are unavailable, rate-limited, or stale, tipping discovery fails closed and users can instead enter a raw Solana address into the existing exact-address flow.

## Privacy, abuse, and anti-spoofing controls

| Risk | Control | Residual limitation |
| --- | --- | --- |
| Global handle/address scraping | No global raw-handle search, no plaintext social ID/address on anchor, no public autocomplete, opaque Tip Card discovery secret, scope-bound lookup authorization, and rate limits per caller/scope. | A user who deliberately shares a Tip Card enables scoped discovery for its allowed lifetime. |
| Username/nickname collision | Platform-native stable ID only; handle is display metadata. | Platform itself remains identity authority. |
| Unicode/confusable impersonation | Show platform badge, verified-selection indicator, and full address; never use display name as a signing target. | Users can still be socially engineered outside the application. |
| Attester compromise | Threshold receipts across independently governed failure domains, key rotation/revocation, publishable receipt logs, and wallet signature requirement. | A threshold of colluding/compromised attesters can falsely assert platform control but still cannot forge the user's wallet binding signature. |
| Wallet compromise | Immediate wallet-signed revocation; social recovery can suspend only. | An attacker with current wallet key can issue valid-looking rotation/revocation until the user acts. |
| Replica censorship/outage | Multi-replica retrieval, independently verifiable bundles, root checkpoints, local proof cache with strict expiry, and raw-address fallback. | A broad network/platform outage prevents safe social resolution. |
| Equivocation | Quorum root certificate, inclusion/consistency proofs, immutable evidence hashes, and conflict-as-error policy. | A compromised membership threshold can sign a false root; governance/audit remains necessary. |
| Directory correlation | Per-scope opaque commitments, short-lived discovery capabilities, minimized metadata, no sender wallet/amount in request, and optional privacy relay. | Resolver operators still observe timing/IP unless a separately reviewed privacy transport is used. |
| Spam / unsolicited tips | Recipient opt-in, scope/reuse limits, DM/community settings, sender rate limits, and recipient block/revoke support. | On-chain transfers themselves remain irreversible once user signs. |

No resolver, root anchor, or attester can eliminate the social engineering risk of a user approving the wrong address. The client must prominently label the address as the actual destination, show it in full before a transfer intent, and keep the signing flow's existing preflight/review/approval controls.

## Data retention and exposure

Replica logs retain signature-bearing record hashes and minimal expiry/revocation data for consistency proof. A production privacy policy must specify whether replicas store encrypted attestation envelopes, how record expiration is compacted, legal basis/retention, abuse-report handling, node data-disclosure procedures, and metadata minimization. The Solana anchor stores only root/membership commitments, not reversible social-ID/handle/address claims. Public anchoring is irreversible enough to require a privacy review before production.

W3C's VC data model warns that easy collection/correlation of verifiable data can become a privacy problem; its verification model also requires a verifier to check the claim against its own policies rather than treating a signature as sufficient.[3] This design therefore makes directory discovery opt-in, scoped, revocable, and non-authoritative for payment without a final wallet review.

## Non-goals and implementation gates

The architecture does not implement a Solana program, a DID method, a VC stack, threshold-signature scheme, replica network, content-addressed store, identity verifier, wallet proof, chat bot API, privacy relay, or live tip. It does not resolve arbitrary users across Discord/Telegram by public username. It does not provide KYC, sanctions screening, dispute resolution, escrow, chargebacks, fee collection, token support, staking, trading, betting, or a legal/compliance assessment.

Before implementation, select and independently review: the precise attestation signing library and canonicalization implementation; membership/key-governance protocol; attester independence criteria; Discord/Telegram policy-compatible ceremonies; Tip Card UX; anti-enumeration/rate/privacy transport; record store and retention model; root anchor program and PDA/instruction/account ownership model; quorum parameters; failure/incident procedures; security/audit owner; and jurisdictional requirements. No user identity or wallet address may be attested, anchored, or resolved until that review and explicit production authorization occur.

## References

[1]: https://docs.discord.com/developers/resources/user "Discord: User Resource"
[2]: https://core.telegram.org/bots/api#user "Telegram: Bot API User and Update"
[3]: https://www.w3.org/TR/vc-data-model-2.0/ "W3C: Verifiable Credentials Data Model v2.0"
[4]: https://www.rfc-editor.org/rfc/rfc8785 "RFC 8785: JSON Canonicalization Scheme"
[5]: https://solana.com/docs/core/accounts "Solana: Accounts"
[6]: https://solana.com/docs/core/pda "Solana: Program Derived Addresses"
