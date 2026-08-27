/**
 * Future integration contract only. Implementations must keep key material local to a user-controlled
 * wallet/client and must never be added to Discord, Telegram, service, queue, or audit adapters.
 */
export interface WalletControlChallenge {
  kind: 'WALLET_CONTROL_PROOF_V1'
  challengeId: string
  audience: string
  nonce: string
  issuedAt: string
  expiresAt: string
  requestId: string
  statement: string
}

export interface WalletControlProof {
  challengeId: string
  address: string
  signedMessage: Uint8Array
  signature: Uint8Array
  signatureType: 'ed25519'
}

export interface ReviewedNativeSolTransfer {
  kind: 'NATIVE_SOL_TRANSFER_V1'
  approvalId: string
  intentId: string
  intentVersion: number
  transactionFingerprint: string
  serializedMessage: Uint8Array
  network: 'solana:devnet'
  senderAddress: string
  recipientAddress: string
  amountLamports: bigint
  feePayer: string
  estimatedFeeLamports: bigint
  lastValidBlockHeight: bigint
}

export type LocalSigningResponse =
  | { kind: 'SIGNED_LOCAL'; signedTransaction: Uint8Array }
  | { kind: 'USER_REJECTED' }
  | { kind: 'UNAVAILABLE'; safeReason: 'WALLET_UNAVAILABLE' | 'UNSUPPORTED_CAPABILITY' | 'LOCAL_AUTH_REQUIRED' }

export interface UserControlledWalletSigner {
  proveWalletControl(challenge: WalletControlChallenge): Promise<WalletControlProof>
  signReviewedNativeSolTransfer(request: ReviewedNativeSolTransfer): Promise<LocalSigningResponse>
}
