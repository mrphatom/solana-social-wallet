# Social Directory Multi-Replica Resolver Protocol

## Design objective

The resolver protocol ensures that a single directory database, application server, or replica cannot silently redirect a social tip to a different Solana address. It does this by separating **record authenticity** from **record availability** and requiring a wallet client to verify multiple independent sources before it exposes a verified address to the transfer-intent flow.

The protocol does not guarantee availability under a broad platform, internet, governance, or chain outage. It is intentionally designed to fail safe: if sufficient current evidence cannot be verified, social resolution is unavailable and the sender may use the existing raw-address flow with its full-address review. The directory is a convenience layer, not a custody or settlement authority.

## Directory topology

```text
Recipient wallet + fresh platform ceremony
                  │
                  ▼
   signed binding + t attester control receipts
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
  replica A   replica B   replica C ... stores the same signed bundle
       │          │          │
       └── signed append-only roots / membership certificate ──► optional Solana root anchor
                                                                  (root and membership commitments only)

Sender wallet/client
       │ verifies Tip Card + recipient stable ID
       ▼
 queries independent replicas ──► validates signatures, proofs, sequence, status, root freshness
       │
       ├─ sufficient matching evidence ──► address candidate + user review
       └─ conflict / stale / unavailable ─► no social resolution
```

Each replica must operate an append-only, content-addressed record store with a Merkle log or an equivalently specified transparency structure. An append-only log makes historical substitution detectable only when clients request inclusion/consistency proof and compare signed roots; merely publishing a hash does not provide safety.

The implementation must identify independent **failure domains**, not merely endpoints. Distinct replicas share a failure domain when one administrator, cloud tenancy, signing key, database, deployment pipeline, legal control, or DNS authority can compromise or stop all of them. Resolver clients count each failure domain once.

## Membership and root certificate

The signed `DirectoryMembershipV1` document defines a current membership epoch. It is itself verified from an anchor root or a prior quorum certificate and includes only public operator metadata.

| Field | Requirement |
| --- | --- |
| `directoryNamespace` | Exact deployment/cluster namespace. |
| `membershipEpoch` | Positive monotonic decimal string. |
| `notBefore`, `notAfter` | Bounded validity interval; clients reject future or expired sets. |
| `operators` | Public attester/replica key IDs, public verification keys, failure-domain IDs, supported platforms, endpoint commitments, and key validity windows. |
| `attesterThreshold` | Threshold `t` required for platform-control receipts. |
| `rootThreshold` | Threshold `r` required for a root certificate. |
| `previousMembershipHash` | Hash-chain predecessor; `null` only for the audited genesis membership. |
| `activationDelay` | Minimum delay before a normally approved membership becomes active. |
| `proofs` | Individual detached signatures from sufficient prior-epoch authorities; no aggregate format is assumed until separately standardized/reviewed. |

`DirectoryRootV1` commits to an exact append-only log state and must carry the namespace, membership epoch/hash, replica log ID, tree size, root hash, previous root hash, issue/expiry time, and a set of `r` signatures from distinct current failure domains. Replicas publish roots at a fixed cadence and retain every signed root required for the consistency window. A client rejects a root with a membership mismatch, wrong namespace, expired key, insufficient/duplicated failure domain, unexpected tree regression, or invalid signature.

An optional Solana anchor account may store the latest `(membershipHash, rootHash, treeSize, rootCertificateHash, epoch)` checkpoint. Solana accounts are program-owned state and PDAs are deterministic/off-curve addresses without private keys, but this makes the program authority, state-transition rules, account ownership, and governance a separate security surface.[1] [2] A root anchor proves only that a checkpoint was committed under its authority; it does not prove that a social identity claim is true, that off-chain data is available, or that an attester threshold was non-collusive.

## Resolver request and response

### Request

The caller begins with a recipient-controlled Tip Card and a verified platform-native subject ID acquired through a permitted context. It computes the scoped subject commitment locally. The request body is intentionally small:

```ts
export interface DirectoryResolutionRequestV1 {
  kind: 'SSW_DIRECTORY_RESOLUTION_REQUEST_V1'
  directoryNamespace: string
  subjectCommitment: string
  tipCardId: string
  requestNonce: string
  minimumRootIssuedAt: string
  requestedAt: string
  authorization: {
    kind: 'TIP_CARD_CAPABILITY_V1'
    // Opaque, scoped, expiring proof. Not a bearer user session or wallet signature.
    capability: string
  }
}
```

The request does not include a raw handle, plaintext platform user ID, sender wallet address, amount, transaction ID, chat contents, wallet-control proof, or payment signature. A production client uses a privacy relay or other reviewed transport if resolver-visible IP/timing correlation is unacceptable; transport privacy is not solved by cryptographic record commitments.

### Response

Every replica returns one of three mutually exclusive signed outcomes: `NO_CURRENT_BINDING`, `RESOLUTION_BUNDLE`, or `UNAVAILABLE`. It never returns a naked address.

```ts
export type DirectoryResolutionResponseV1 =
  | { kind: 'NO_CURRENT_BINDING'; root: DirectoryRootProof; responseProof: DetachedProof }
  | {
      kind: 'RESOLUTION_BUNDLE'
      bundleHash: string
      walletBinding: CanonicalSignedRecord
      attesterReceipts: readonly CanonicalSignedRecord[]
      statusRecord: CanonicalSignedRecord
      inclusionProof: MerkleInclusionProof
      consistencyProof: MerkleConsistencyProof | null
      root: DirectoryRootProof
      responseProof: DetachedProof
      displayMetadata: { displayName: string | null; platform: 'discord' | 'telegram' }
    }
  | { kind: 'UNAVAILABLE'; retryAfterSeconds: number | null; safeReason: 'OVERLOADED' | 'STALE_ROOT' | 'SCOPE_DENIED'; responseProof: DetachedProof }
```

`displayMetadata` is untrusted presentation text. The UI escapes it, labels it as a platform display name, applies Unicode-confusable warning logic, and never uses it to derive or replace a recipient address. Address disclosure is delayed until the complete bundle passes local verification.

## Client-side verification and quorum

The wallet client chooses a resolver set from the verified membership document. It sends the same request nonce to at least three independent failure domains where available, with per-request deadlines and a total time budget. It limits in-flight attempts, caches only verifiable public metadata with strict expiry, and never treats an HTTP success as record validity.

| Step | Required local verification | Result if failed |
| --- | --- | --- |
| Membership | Namespace, epoch, root threshold, key validity, signature set, failure-domain uniqueness, and anchor/certificate chain. | `DIRECTORY_MEMBERSHIP_UNVERIFIED`. |
| Request binding | Tip Card, scope, capability, expiry/reuse policy, platform subject commitment, and nonce. | `DISCOVERY_NOT_AUTHORIZED`. |
| Response integrity | Response signature matches queried replica key and request nonce. | Drop response. |
| Wallet binding | Canonical bytes, record schema, recipient Ed25519 signature, expected subject commitment, namespace, sequence chain, expiry, and consent. | Drop response. |
| Platform attestations | Binding hash, current attester key, short receipt lifetime, scope commitment, nonce, attestation level, and `t` distinct failure domains. | Drop response. |
| Status | Latest accepted status sequence is `ACTIVE`; no verified rotation/revocation/suspension/expiry supersedes it. | `RECIPIENT_NOT_AVAILABLE`. |
| Transparency | Leaf inclusion under root, consistent tree size/root progression, membership epoch, root signatures, and root freshness. | Drop response. |
| Cross-replica agreement | At least `q` independent domains return identical `bundleHash`, status hash, root certificate hash, and address. | `DIRECTORY_CONFLICT` or `DIRECTORY_UNAVAILABLE`. |
| UI binding | Full base58 address, recipient/context, freshness/assurance labels, and transfer-review handoff. | No transfer intent. |

For a deployment with five genuinely independent operators, an initial policy may use `t=2` distinct platform attesters, `r=3` root signatures, and `q=2` matching replicas plus a valid 3-of-5 root certificate. These values are operational parameters, not facts imposed by a standard. They must be calibrated through security review and game-day testing before use, and membership policy must prevent a single operator from adding a self-controlled quorum.

The client compares **identical verified bundle hashes**, not only matching address strings. Two replicas that give the same address but disagree about sequence/status/root are a conflict. The client refuses to select the oldest/newest/majority/first address because timing and count alone do not settle an equivocation attack.

## Availability and degradation policy

| Scenario | Accepted behavior | Prohibited behavior |
| --- | --- | --- |
| One replica times out or 429s | Continue only within bounded multi-replica time/attempt budget. | Unlimited retries or lowering quorum silently. |
| One replica returns malformed/invalid proof | Drop and record a privacy-safe evidence hash. | Use its address or echo raw response to the user. |
| Two valid responses differ | Stop with `DIRECTORY_CONFLICT`; offer non-financial retry/report route. | Choose an address by response count or clock. |
| Latest anchor unreadable | Accept a threshold-signed cached root only when permitted by explicit freshness policy and the membership/root chain is already verified. | Write/rotate/revoke based on stale/degraded authority. |
| All replicas unavailable | Social discovery fails safe; allow standard manually entered address route. | Reuse a stale address for payment or treat handle as address. |
| Attester threshold unavailable | New/renewed directory records cannot become `ACTIVE`. | Convert a lower-assurance receipt into a standard verified binding. |
| Platform API unavailable | Existing active record can be resolved only within record/root freshness policy; new identity ceremonies wait. | Guess from cached profile/handle data. |

Solana RPC endpoints can lag, rate-limit, or fail. A future root-anchor verifier therefore uses bounded deadlines, classified retries with jitter, an explicit provider/fallback list, and one documented commitment policy. It must treat a root-anchor read as an independently checked input, not as a reason to discard an otherwise detected replica conflict.[3]

## Privacy and anti-enumeration implementation requirements

The resolver supports lookup only after a verifier client has a valid Tip Card capability plus verified social subject context. It must not provide `GET /lookup?username=...`, public autocomplete, bulk list/search, count endpoint, address export, public “is this user registered?” result, or an attacker-controlled callback URL. It rate-limits by capability, scope, recipient binding, client authorization, and network-abuse policy without using rate limits as an identity proof.

Replica operators publish only opaque record IDs, commitment hashes, signature/proof material, expiry/status, and root inclusion data. Full binding records can be encrypted to requester/recipient session keys if the selected production privacy model requires it, but that construction is unselected and must not be improvised. Logging uses request/response class, error code, resolver key ID, latency bucket, and truncated privacy-safe hashes. It excludes discovery secrets, platform IDs, IP addresses unless retention is separately approved, handles, addresses, raw messages, and whole attestation documents.

## Governance and incident recovery

Directory governance is an attack surface. The protocol therefore publishes membership-set history, key rotations, signed roots, and a deterministic client verification rule. Normal membership changes require a higher threshold under the previously valid set and a delay. Emergency removals must be visible as exception roots, retain reason class/evidence references, and cannot redirect user bindings.

When a resolver/attester key is suspected compromised, clients remove that failure domain only through a verified emergency membership update. They do not trust a server-delivered new key list. While a required threshold cannot be satisfied, the safe result is unavailable discovery. The recipient wallet can still issue a direct revocation when available; users can always fall back to the normal exact-address transaction path.

## Explicit limits

This architecture avoids one central directory database as the exclusive data source. It does not eliminate centralized elements in Discord/Telegram identity verification, user wallets, platform terms, the Solana network, network transport, operating-system trust, or directory governance. It cannot protect a user who signs a transfer after an address is correctly shown, recover funds, reverse an on-chain transfer, prove a human identity, or provide legal/regulatory compliance.

## References

[1]: https://solana.com/docs/core/accounts "Solana: Accounts"
[2]: https://solana.com/docs/core/pda "Solana: Program Derived Addresses"
[3]: https://solana.com/docs/rpc "Solana: RPC Methods"
