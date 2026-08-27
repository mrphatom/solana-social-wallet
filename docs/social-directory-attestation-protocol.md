# Social Directory Attestation Protocol

## Scope

This protocol defines the signed data required to bind a verified Discord or Telegram identity to a Solana address for **social-tip discovery**. It is an architecture contract, not a deployed identity service. It does not issue an attestation, query a social platform, create a Solana account, register a DID, sign with a wallet, or resolve any user.

The protocol deliberately keeps four claims separate: **platform control**, **wallet control**, **recipient consent**, and **payment authorization**. A valid record can establish only the first three. A sender still must create a new non-custodial transfer intent, review the full destination address, and approve a separate exact Solana transaction in their own wallet.

| Claim | Evidence | Authority | Cannot establish |
| --- | --- | --- | --- |
| Platform control | Threshold platform-attester receipts from a fresh in-context ceremony. | Independent attesters using verified Discord/Telegram ingress. | Control of a Solana address. |
| Wallet control | Recipient's Solana Ed25519 signature over one canonical binding. | Recipient's wallet. | Control of a Discord/Telegram identity. |
| Tip consent | Recipient-issued Tip Card plus scope/expiry/reuse restrictions. | Recipient through a verified bound identity/wallet process. | Sender authority to move funds. |
| Payment authorization | Sender's fresh, exact-message signature in their wallet. | Sender's wallet only. | Any ongoing recipient discovery authority. |

## Canonical value rules

Every record declares `protocolVersion: 1` and `canonicalization: "RFC8785"`. Field names, enum values, timestamps, byte encodings, and hash algorithms are normative within this protocol version. Signature input is RFC 8785 canonical UTF-8 bytes after removing the `proof` field; it is never a serializer-dependent object or a visual UI string. RFC 8785 exists to make JSON signature/hash input invariant and requires receivers to parse, validate, canonicalize, then verify or abort.[1]

All values that might exceed JSON's safe integer range are decimal strings. Nonces are 32 random bytes encoded as base64url without padding. Hashes are SHA-256 bytes encoded as `sha256:<base64url>`. Solana public addresses are canonical base58 text and are validated as 32-byte Ed25519 public keys by the recipient wallet, attester, and resolver. No record accepts a private key, seed, recovery phrase, bot token, session cookie, full raw platform event, or raw message body.

## Scoped subject commitment

The system uses a recipient-controlled discovery secret so a public root cannot be cheaply enumerated from known user IDs. The exact input is a length-delimited byte tuple, not string concatenation:

```text
SSW-SUBJECT-COMMITMENT-V1 || directoryNamespace || platform || scopeKind || scopeId
  || stablePlatformUserId || discoverySecretId || discoverySecret
```

The output is `subjectCommitment = SHA-256(tuple)`. `discoverySecret` is a minimum 32-byte cryptographically random recipient-held value. A Tip Card can disclose the secret only to an intended sender/context and has an expiry/reuse policy. A requester cannot calculate the commitment from a raw handle alone, and a resolver cannot reverse a commitment into a platform ID. The commitment's confidentiality is still limited: anyone holding a Tip Card can request scoped discovery until that card expires or is revoked.

The `scopeKind` is one of `DIRECT`, `DISCORD_GUILD`, `TELEGRAM_CHAT`, or `CROSS_PLATFORM_CARD`. `scopeId` is an opaque platform-native chat/guild identifier only in the preimage, never in a public on-chain anchor. `directoryNamespace` includes deployment and cluster, such as `ssw.directory.devnet.v1`, which prevents a record from a test environment or other application being replayed into a production tip resolver.

## Attestation envelope

### Recipient Wallet Binding

The recipient obtains a wallet-control signature through the separate non-custodial signing protocol. Its statement must use the exact wording that no transfer is approved. The signed record is self-authenticating only with respect to address control.

| Field | Value and validation |
| --- | --- |
| `type` | Literal `SSW_SOCIAL_WALLET_BINDING_V1`. |
| `bindingId` | 128-bit opaque random identifier, base64url. |
| `directoryNamespace` | Exact resolver deployment/cluster namespace. |
| `subjectCommitment` | SHA-256 commitment above. |
| `solanaAddress` | Recipient public address, canonical base58 / 32-byte key. |
| `sequence` | Positive monotonic decimal string, starting at `1`. |
| `issuedAt`, `expiresAt` | RFC 3339 UTC instants within maximum binding lifetime. |
| `previousBindingHash` | Previous accepted binding hash, or `null` only at sequence `1`. |
| `consent` | Literal `SOCIAL_TIP_DISCOVERY_ONLY`. |
| `proof` | Detached Ed25519 signature over canonical field set, verified against `solanaAddress`. |

An expiry protects stale discovery records but does not serve as a compromise response. A recipient wallet may issue a revocation sequence at any time. Verifiers reject a record if its sequence is lower than a current rotation/revocation record, if `previousBindingHash` fails to chain, or if it is outside its permitted namespace/scope.

### Platform Attester Receipt

The recipient must complete a fresh platform ceremony that proves they control the **stable platform subject ID** in the intended scope. The exact ceremony is deployment- and platform-policy-specific, but it must be initiated in the relevant verified bot/application context, bind a one-time attester nonce to one subject commitment/binding hash, require recipient consent, and verify platform ingress before receipt creation.

| Field | Value and validation |
| --- | --- |
| `type` | Literal `SSW_PLATFORM_CONTROL_RECEIPT_V1`. |
| `receiptId` | 128-bit opaque random identifier. |
| `attesterKeyId` | Key selected from a valid, anchored membership set. |
| `platform` | Exact supported platform enum. |
| `scopeCommitment` | SHA-256 commitment to platform/scope details; no plaintext user/chat ID. |
| `subjectCommitment` | Equals the wallet-binding statement exactly. |
| `bindingHash` | Hash of the canonical wallet-binding record. |
| `ceremonyNonceHash` | Hash of the single-use attester nonce. |
| `issuedAt`, `expiresAt` | Short attestation lifetime; must be within current key validity. |
| `attestationLevel` | `IN_CONTEXT_VERIFIED` or policy-labeled lower assurance; never silently upgraded. |
| `proof` | Attester's detached signature over canonical fields. |

The receipt has no wallet address, display name, or stable platform ID. Attesters may retain minimal private evidence required for abuse/dispute policies, but a public replica receives only the receipt above. Distinct receipts count only when their attester keys belong to distinct approved failure domains in the same current membership epoch.

### Tip Card

The Tip Card is a recipient-controlled discovery capability, not a directory record and not a financial authorization. It has a short default life, narrow scope, and explicit invalidation version. A user may share it only when they want to be discoverable for a tip.

```json
{
  "type": "SSW_TIP_CARD_V1",
  "cardId": "opaque-128-bit-id",
  "directoryNamespace": "ssw.directory.devnet.v1",
  "discoverySecret": "base64url-32-byte-secret",
  "scopeKind": "DISCORD_GUILD",
  "scopeReference": "opaque-scope-reference",
  "validUntil": "2026-08-27T13:00:00Z",
  "maxResolutions": "1",
  "cardVersion": "3",
  "disclaimer": "Find my address for a social tip. This never approves a transfer."
}
```

The card is delivered by a recipient into a supported platform context or through a user-controlled encrypted channel. It must not be posted in a public profile, stored in a referral URL, recorded in a bot log, or used as an automatic directory lookup key. A resolver must verify the card's scope/reuse/expiry and current binding status before disclosing an address to a sender.

### Status Statements

Status is monotonic within a `(namespace, subjectCommitment)` stream.

| Status | Issuer requirement | Resolver effect |
| --- | --- | --- |
| `ACTIVE` | Valid wallet binding and attester threshold. | Eligible only through a valid Tip Card/scope. |
| `ROTATED` | Current old wallet and replacement wallet both sign a next-sequence rotation; fresh attester threshold binds the same subject commitment. | Prior address is invalid; only next address may be resolved after quorum/root update. |
| `REVOKED` | Current bound wallet signs revocation; current attester quorum also accepts user-initiated revocation ceremony. | Immediately unavailable for new discovery. |
| `SUSPENDED` | Attester threshold records platform-account compromise or recipient suspension without selecting a new address. | Immediately unavailable; cannot become active without a new wallet binding/attestation sequence. |
| `EXPIRED` | Time passes with no active renewal. | Unavailable; requires new binding/attestation. |

Rotation cannot be requested merely by the social account: social recovery may produce only `SUSPENDED`. This prevents a platform-account takeover or a malicious attester quorum from redirecting a recipient's tips to a different wallet address without a wallet signature.

## Validation sequence

Resolvers must apply the following order and stop at first failure. The sequence prevents accidental address disclosure, DoS amplification, and confused authority paths.

1. Validate request schema, size, namespace, network, request nonce, rate limit, and discovery authorization.
2. Validate Tip Card expiry, scope, recipient policy, reuse count, and `subjectCommitment` recomputation from card plus verified platform subject. A handle-only request stops here.
3. Validate each candidate record's JSON/I-JSON/JCS form, protocol version, field types, max sizes, duplicate-field absence, signature encoding, and key membership epoch.
4. Verify binding signature against its own Solana address, then verify binding lifetime, consent enum, sequence chain, and status ordering.
5. Verify each platform receipt's signature/key validity, binding hash, subject/scope commitment, nonce hash, time interval, attestation level, and distinct failure domain.
6. Verify current membership set, replica log inclusion/consistency proof, root quorum certificate, optional anchor reference, freshness, and absence of a newer rotation/revocation/suspension sequence.
7. Require independent replica agreement on identical binding/status/root hashes. A conflict is `DIRECTORY_CONFLICT`, never an address choice.
8. Return only an address-discovery candidate with a complete verification summary. A wallet client must still show the full address and start a new transfer-intent flow.

## Key management and governance

The wallet key that signs a binding belongs solely to the recipient. An attester signing key belongs to a directory operator and must be hardware-protected or managed through a separately reviewed service-signing policy. It cannot be a Discord/Telegram bot token, a user wallet key, an API secret, or a long-lived hot key without rotation/revocation controls.

Membership root checkpoints list each attester/replica public key, failure-domain identifier, key validity period, allowed platform/scope, endpoint metadata commitment, and quorum parameters. Changing membership uses a higher threshold of the previous valid membership epoch and a delayed activation period. Emergency removal requires its own audited break-glass policy and must visibly label the root as exceptional. A single project administrator must not have authority to add enough keys to satisfy the normal threshold.

## Privacy and misuse constraints

This protocol supports selective, scoped disclosure rather than public identity indexing. W3C notes that verifiable data can create correlation risks and that the verifier must evaluate claims under its own policies; cryptographic verification alone does not establish appropriate reliance.[2] A resolver therefore exposes only minimum recipient data to an authorized sender and does not return an address in search/autocomplete responses.

The protocol does not prevent a recipient from publishing their Tip Card or address publicly, a sender from copying an address after display, an attester threshold from being compromised, a platform from changing its APIs, a recipient's wallet from being compromised, or a network-wide outage. These remain explicit risks and are not resolved by the word “decentralized.”

## References

[1]: https://www.rfc-editor.org/rfc/rfc8785 "RFC 8785: JSON Canonicalization Scheme"
[2]: https://www.w3.org/TR/vc-data-model-2.0/ "W3C: Verifiable Credentials Data Model v2.0"
[3]: https://docs.discord.com/developers/resources/user "Discord: User Resource"
[4]: https://core.telegram.org/bots/api#user "Telegram: Bot API User"
