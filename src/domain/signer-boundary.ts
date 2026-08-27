export type SigningCaller =
  | 'EXTERNAL_WALLET'
  | 'NATIVE_COMPANION'
  | 'SOCIAL_BOT_SERVICE'
  | 'SOCIAL_WALLET_API'
  | 'QUEUE_WORKER'
  | 'AUDIT_LOGGER'
  | 'BROWSER_PWA'

export type SigningRequestKind = 'NATIVE_SOL_TRANSFER_V1' | 'WALLET_CONTROL_PROOF' | 'ARBITRARY_MESSAGE'

export interface SigningAuthorityInput {
  caller: SigningCaller
  requestKind: SigningRequestKind
  hasFreshWalletControl: boolean
  hasExactMessageReview: boolean
  isTransactionFingerprintCurrent: boolean
}

export type SigningAuthorityDecision =
  | { kind: 'AUTHORIZED_USER_SIGNATURE' }
  | {
      kind: 'DENIED'
      reason:
        | 'CALLER_CANNOT_SIGN_USER_ASSETS'
        | 'SIGN_REQUEST_KIND_NOT_ALLOWED'
        | 'FRESH_WALLET_CONTROL_REQUIRED'
        | 'EXACT_MESSAGE_REVIEW_REQUIRED'
        | 'TRANSACTION_FINGERPRINT_STALE'
    }

const userControlledSigningCallers = new Set<SigningCaller>(['EXTERNAL_WALLET', 'NATIVE_COMPANION'])

/**
 * Authorization policy only: it has no key, signer, wallet SDK, network, or transaction side effect.
 * See docs/non-custodial-key-architecture.md and ADR-004/ADR-005 before adding an implementation.
 */
export function evaluateSigningAuthority(input: SigningAuthorityInput): SigningAuthorityDecision {
  if (!userControlledSigningCallers.has(input.caller)) {
    return { kind: 'DENIED', reason: 'CALLER_CANNOT_SIGN_USER_ASSETS' }
  }
  if (input.requestKind !== 'NATIVE_SOL_TRANSFER_V1') {
    return { kind: 'DENIED', reason: 'SIGN_REQUEST_KIND_NOT_ALLOWED' }
  }
  if (!input.hasFreshWalletControl) {
    return { kind: 'DENIED', reason: 'FRESH_WALLET_CONTROL_REQUIRED' }
  }
  if (!input.hasExactMessageReview) {
    return { kind: 'DENIED', reason: 'EXACT_MESSAGE_REVIEW_REQUIRED' }
  }
  if (!input.isTransactionFingerprintCurrent) {
    return { kind: 'DENIED', reason: 'TRANSACTION_FINGERPRINT_STALE' }
  }
  return { kind: 'AUTHORIZED_USER_SIGNATURE' }
}
