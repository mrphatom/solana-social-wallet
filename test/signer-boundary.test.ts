import { describe, expect, it } from 'vitest'

import { evaluateSigningAuthority } from '../src/domain/signer-boundary.js'

describe('non-custodial signer boundary', () => {
  it('allows a user-controlled external wallet to sign a reviewed native SOL request without granting the bot signing authority', () => {
    expect(
      evaluateSigningAuthority({
        caller: 'EXTERNAL_WALLET',
        requestKind: 'NATIVE_SOL_TRANSFER_V1',
        hasFreshWalletControl: true,
        hasExactMessageReview: true,
        isTransactionFingerprintCurrent: true
      })
    ).toEqual({ kind: 'AUTHORIZED_USER_SIGNATURE' })

    expect(
      evaluateSigningAuthority({
        caller: 'SOCIAL_BOT_SERVICE',
        requestKind: 'NATIVE_SOL_TRANSFER_V1',
        hasFreshWalletControl: true,
        hasExactMessageReview: true,
        isTransactionFingerprintCurrent: true
      })
    ).toEqual({ kind: 'DENIED', reason: 'CALLER_CANNOT_SIGN_USER_ASSETS' })
  })

  it('denies arbitrary signing, stale review, and wallet-control proofs that are not a reviewed transaction approval', () => {
    expect(
      evaluateSigningAuthority({
        caller: 'EXTERNAL_WALLET',
        requestKind: 'ARBITRARY_MESSAGE',
        hasFreshWalletControl: true,
        hasExactMessageReview: true,
        isTransactionFingerprintCurrent: true
      })
    ).toEqual({ kind: 'DENIED', reason: 'SIGN_REQUEST_KIND_NOT_ALLOWED' })

    expect(
      evaluateSigningAuthority({
        caller: 'EXTERNAL_WALLET',
        requestKind: 'NATIVE_SOL_TRANSFER_V1',
        hasFreshWalletControl: false,
        hasExactMessageReview: true,
        isTransactionFingerprintCurrent: true
      })
    ).toEqual({ kind: 'DENIED', reason: 'FRESH_WALLET_CONTROL_REQUIRED' })

    expect(
      evaluateSigningAuthority({
        caller: 'NATIVE_COMPANION',
        requestKind: 'NATIVE_SOL_TRANSFER_V1',
        hasFreshWalletControl: true,
        hasExactMessageReview: false,
        isTransactionFingerprintCurrent: true
      })
    ).toEqual({ kind: 'DENIED', reason: 'EXACT_MESSAGE_REVIEW_REQUIRED' })

    expect(
      evaluateSigningAuthority({
        caller: 'NATIVE_COMPANION',
        requestKind: 'NATIVE_SOL_TRANSFER_V1',
        hasFreshWalletControl: true,
        hasExactMessageReview: true,
        isTransactionFingerprintCurrent: false
      })
    ).toEqual({ kind: 'DENIED', reason: 'TRANSACTION_FINGERPRINT_STALE' })
  })
})
