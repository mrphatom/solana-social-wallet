# Secure Solana Signing Protocol

## Purpose

This protocol turns a social-wallet transfer intent into a user-controlled Solana action without letting Discord, Telegram, or the bot service spend funds. It is a specification for a **future wallet client**; the current repository does not implement the protocol, call an RPC, connect a wallet, generate a signature, or submit a transaction.

The protocol supports one narrow v1 action: a native SOL transfer on an explicitly selected Solana cluster, using a verified internal recipient. Token transfers, staking, swaps, program invocation, priority-fee customization, multisig, durable nonce, delegated authority, and batch actions must be introduced only in later protocol versions with their own allowlists and security review.

> **Signing rule:** The wallet signs only the exact serialized Solana transaction message it displays to the user after a fresh preflight. A chat command, a previously signed wallet-control message, an intent ID, a display username, a QR/deep link, or a server instruction is never itself authorization to sign or submit a transaction.

## Protocol actors

| Actor | Authority | Cannot do |
| --- | --- | --- |
| Social-wallet bot | Resolve verified social recipients and create a recipient-bound transfer intent. | Generate key material, sign, change an approved transaction, submit user assets, or infer confirmation. |
| Social-wallet API | Issue short-lived view/approval tokens and store immutable intent/audit state. | Receive recovery material or a reusable signing credential. |
| Wallet client | Authenticate wallet control, display/validate a transaction, request user approval, sign locally, and submit directly to an allowed RPC. | Blind-sign arbitrary payloads or accept changed request fields after review. |
| External wallet / native companion signer | Retain the private key and enforce local approval policy. | Delegate unlimited future spend authority to the bot. |
| Read-only RPC service | Serve recent blockhash, account state, simulation, submission, and signature status. | Be treated as a trusted transaction authority or custody component. |

## Domain separation

Two cryptographic operations exist and must never be substituted for one another.

| Operation | Purpose | Required contents | Validity | May move assets? |
| --- | --- | --- | --- | --- |
| Wallet-control authentication | Prove control of one public address for a shared social account. | Domain/audience, nonce, chain, issue/expiry, request ID, explicit non-payment statement. | One use; short-lived. | No. |
| Transaction signature | Authorize one exact Solana message. | Serialized message containing exact fee payer, account roles, recent blockhash, instructions, and values. | Until blockhash expires or a durable nonce policy is used. | Yes, if submitted and processed. |

The SIWS reference describes why a structured sign-in message binds domain, nonce, timestamps, request ID, and expected wallet account; verification must happen server-side against the original challenge.[1] The control-proof session created after this verification is an authorization context for **viewing/retrieving an intent**, not a blanket transaction authorization.

## Immutable request artifacts

The service maintains two immutable, versioned records: a logical intent and a just-in-time approval request. Neither contains private material.

```ts
// Architecture contract only. It has no signer or transport implementation.
export interface WalletApprovalRequestV1 {
  kind: 'SOLANA_NATIVE_TRANSFER_V1'
  approvalId: string
  intentId: string
  intentVersion: number
  walletAddress: string
  network: 'solana:devnet'
  recipient: {
    verifiedSocialAccountId: string
    displayName: string
    sourcePlatform: 'discord' | 'telegram'
    sourcePlatformUserId: string
    solanaAddress: string
  }
  amountLamports: bigint
  expiresAt: string
  requestNonce: string
  requiredProgramIds: readonly ['11111111111111111111111111111111']
  allowedInstructionCount: 1
  transactionFingerprint: string | null
  state: 'AWAITING_BUILD' | 'AWAITING_REVIEW' | 'AWAITING_SIGNATURE' | 'CANCELLED' | 'EXPIRED'
}

export interface ReviewedTransactionV1 {
  approvalId: string
  intentVersion: number
  transactionFingerprint: string
  serializedMessage: Uint8Array
  recentBlockhash: string
  lastValidBlockHeight: bigint
  feePayer: string
  simulation: {
    commitment: 'confirmed'
    slot: bigint
    estimatedFeeLamports: bigint
    unitsConsumed: bigint | null
    err: null
  }
}
```

`transactionFingerprint` is a versioned digest of the exact serialized message, not a digest of user-entered display text. The UI may use a separate logical-intent fingerprint before a blockhash is fetched, but it must never imply that such a logical fingerprint is ready to sign. The signer recomputes/validates the exact-message fingerprint locally. Any mismatch fails closed.

Solana transaction messages include signer/account permissions, recent blockhash, and compiled instructions, and signatures are Ed25519 signatures over the serialized message.[2] The protocol therefore displays both a high-level transfer summary and the critical raw facts that alter authority: network, fee payer, full destination, total lamports, required signer count, every writable account, every program ID, recent-blockhash expiry, and all instructions.

## Transaction state machine

```text
AWAITING_WALLET_APPROVAL
        │ wallet-control proof + intent access
        ▼
AWAITING_BUILD ── build/preflight failure ───────────► FAILED_PRE_SIGN
        │ exact tx built with current blockhash
        ▼
AWAITING_REVIEW ── cancel / expiry / fingerprint mismatch ─► CANCELLED | EXPIRED | INVALIDATED
        │ user reads summary and opens wallet approval
        ▼
AWAITING_SIGNATURE ── user rejects / wallet unavailable ───► REJECTED | FAILED_PRE_SIGN
        │ exact-message signature returned locally
        ▼
SIGNED_LOCAL ── local serialization/hash check fails ───────► INVALIDATED
        │ user confirms direct submission
        ▼
SUBMITTED ── no status by deadline ─────────────────────────► UNKNOWN
        │ read-only status tracking
        ▼
CONFIRMED ── stronger policy finality tracker ──────────────► FINALIZED
        │
        └── rejected / expired / simulation discrepancy ────► FAILED_POST_SIGN
```

The bot's existing `AWAITING_WALLET_APPROVAL` state remains the only state it may create. `SIGNED_LOCAL`, `SUBMITTED`, `CONFIRMED`, `FINALIZED`, `FAILED_*`, `REJECTED`, `EXPIRED`, `CANCELLED`, `INVALIDATED`, and `UNKNOWN` are future wallet-bridge states and must not be emitted by the bot until the implementation gates in the key architecture are met.

## Review-first signing sequence

1. **Fetch and authenticate.** The wallet client obtains a short-lived intent-access session by completing a unique wallet-control challenge. The service verifies domain, nonce, issue/expiry time, request ID, address, signed bytes, and signature, then binds the session to one social account and wallet address. Sessions have idle and absolute lifetimes, revocation, audience, and device/client binding.
2. **Fetch immutable intent.** The wallet client requests one active intent by ID. The API checks that the authenticated wallet address is the current sender binding and returns a read-only intent snapshot with its version. Recipient display data is supplementary; the full Solana destination remains the signing target.
3. **Build locally and narrowly.** The wallet client chooses the documented cluster, fetches a recent blockhash close to signing time, builds exactly one System Program native-SOL transfer, sets the sender as fee payer, and rejects any unexpected program, instruction, signer, writable account, address lookup, compute-budget change, priority fee, memo, token account, or opaque instruction data. The System Program ID is allowlisted as `11111111111111111111111111111111`.
4. **Preflight and verify.** The client performs a same-cluster preflight on the exact unsigned/signed transaction form appropriate to the RPC API. It uses the product-selected `confirmed` commitment for preflight and does not sign when simulation fails, balance/fee input is uncertain, the destination has changed, or the calculated total differs from the user-visible total. Simulation does not broadcast a transaction.[3]
5. **Present human review.** The wallet client displays the social-recipient label, source platform, full base58 address with copy option, exact SOL amount, network, fee payer, estimated fee, total maximum cost, blockhash expiry, and an advanced disclosure of signers, writable accounts, program IDs, and instruction data classification. The user may cancel. No component can time out into approval.
6. **Request local signature.** After an explicit, local wallet action, the signer signs the exact displayed serialized message. The client checks that the signed transaction has the expected number/order of signatures and that its message bytes equal the reviewed message. User rejection is an expected terminal state, not an error to retry.
7. **Submit only after fresh confirmation.** The wallet client gives the user a final “Submit” action or an unambiguous wallet-level combined sign-and-send confirmation. It submits the signed transaction directly to its approved RPC with preflight enabled and the same commitment used for the displayed preflight. It uses no automatic resubmission.
8. **Track truthfully.** A returned transaction signature marks `SUBMITTED`, never `CONFIRMED`. Solana’s RPC documentation states that `sendTransaction` returns once the node accepts the transaction and does not wait for cluster confirmation.[4] The client/worker uses read-only signature-status checks with an explicit commitment policy, preserves an explorer link, and reports timeout as `UNKNOWN` rather than success. Settlement/recipient crediting may require `finalized` and is not part of this product release.

## Transaction parser policy

The client parses the transaction it is about to sign, rather than trusting only a server-provided summary. For v1, parsing must prove all of the following:

| Check | Required result | On failure |
| --- | --- | --- |
| Network | Exact selected cluster identifier and approved RPC configuration. | Block signing. |
| Fee payer | Equals the wallet's selected sender address. | Block signing. |
| Required signers | Exactly one: the selected sender. | Block signing. |
| Program list | Exactly the System Program allowlist. | Block signing. |
| Instruction count/type | Exactly one native SOL transfer instruction. | Block signing. |
| Source | Equals selected sender and is writable/signer as expected. | Block signing. |
| Destination | Equals immutable verified recipient address and is writable. | Block signing. |
| Amount | Equals immutable intent lamports exactly; no UI rounding. | Block signing. |
| Account table / extra instructions | None for v1. | Block signing. |
| Fee/compute changes | No hidden compute/priority/memo configuration in v1. | Block signing. |
| Blockhash | Fresh and valid through disclosed `lastValidBlockHeight`. | Rebuild and repeat review. |
| Simulation | Success at configured commitment with compatible fee/output facts. | Block signing. |

Native SOL transfers can target any account, and Solana cautions that the sender must verify a recipient before sending SOL.[2] The social recipient lookup reduces identity ambiguity, but it never replaces display of and agreement with the exact destination address.

## Transport and deep-link rules

The bot may send only a short-lived link containing an opaque approval locator, a one-time nonce, protocol version, and no transaction serialization, signature, wallet proof, address binding, sensitive platform identifier, amount, or recipient address. The server resolves the locator only after the wallet-control session is established and validates the authenticated wallet/address against the intent sender.

The wallet client must bind the request to its configured HTTPS origin and reject unknown redirect origins. On Android, Mobile Wallet Adapter can be a compatible signing transport for supported environments; the official support matrix lists Android and Android Chrome but not iOS or several other mobile browsers.[5] Consequently, the product must provide an external-wallet/manual route or native companion where MWA is unavailable; it must not show an MWA action as if it works universally.

## Safe failure semantics

| Condition | User-facing state | Retry rule |
| --- | --- | --- |
| Wallet-control proof rejected/expired | Authentication did not complete. | Start a new challenge; never reuse signature. |
| Intent not owned by wallet/session | Intent unavailable. | Do not disclose recipient/amount details. |
| Intent changed/cancelled/expired | Review expired. | Fetch a new intent version; cannot reuse prior review. |
| Simulation fails | Transaction cannot be approved. | Correct source state or build a new intent; never sign. |
| User rejects wallet prompt | User declined. | Terminal for the approval request; no prompt loop. |
| Blockhash expires before send | Approval expired. | Rebuild, simulate, review, and re-sign. |
| RPC send returns signature | Submitted. | Track status; do not resend automatically. |
| RPC status unavailable | Outcome unknown. | Offer explorer/status refresh; no blind resubmission. |
| Signature confirms | Confirmed, commitment labelled. | Do not call finalized unless tracker reaches that commitment. |

## References

[1]: https://github.com/phantom/sign-in-with-solana "Sign In With Solana specification"
[2]: https://solana.com/docs/core/transactions/transaction-structure "Solana: Transaction Structure"
[3]: https://solana.com/docs/rpc/http/simulatetransaction "Solana RPC: simulateTransaction"
[4]: https://solana.com/docs/rpc/http/sendtransaction "Solana RPC: sendTransaction"
[5]: https://docs.solanamobile.com/developers/mobile-wallet-adapter "Solana Mobile: Mobile Wallet Adapter"
