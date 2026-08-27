/**
 * Protocol-agnostic betting remains unavailable. This policy deliberately contains no provider,
 * quote, wagering, signer, wallet, transaction, or network behavior.
 */
export function evaluateBettingCapability(): {
  state: 'NOT_AVAILABLE'
  reason: 'PROTOCOL_COMPLIANCE_AND_PROTECTION_REVIEW_REQUIRED'
} {
  return {
    state: 'NOT_AVAILABLE',
    reason: 'PROTOCOL_COMPLIANCE_AND_PROTECTION_REVIEW_REQUIRED'
  }
}
