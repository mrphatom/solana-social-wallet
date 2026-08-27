/**
 * Future-facing feature registry. No capability here has a provider, wallet, signer, transaction,
 * or network implementation; every result is intentionally unavailable until separate review.
 */
export type SocialFinanceCapability =
  | 'PORTFOLIO_SNAPSHOT'
  | 'NATIVE_SOL_STAKE'
  | 'LIQUID_STAKE'
  | 'LIQUIDITY_POSITION'
  | 'REWARD_CLAIM'

const unavailableCapabilities: Record<
  SocialFinanceCapability,
  {
    state: 'NOT_AVAILABLE'
    reason: 'PROVIDER_PROTOCOL_AND_USER_PROTECTION_REVIEW_REQUIRED'
  }
> = {
  PORTFOLIO_SNAPSHOT: { state: 'NOT_AVAILABLE', reason: 'PROVIDER_PROTOCOL_AND_USER_PROTECTION_REVIEW_REQUIRED' },
  NATIVE_SOL_STAKE: { state: 'NOT_AVAILABLE', reason: 'PROVIDER_PROTOCOL_AND_USER_PROTECTION_REVIEW_REQUIRED' },
  LIQUID_STAKE: { state: 'NOT_AVAILABLE', reason: 'PROVIDER_PROTOCOL_AND_USER_PROTECTION_REVIEW_REQUIRED' },
  LIQUIDITY_POSITION: { state: 'NOT_AVAILABLE', reason: 'PROVIDER_PROTOCOL_AND_USER_PROTECTION_REVIEW_REQUIRED' },
  REWARD_CLAIM: { state: 'NOT_AVAILABLE', reason: 'PROVIDER_PROTOCOL_AND_USER_PROTECTION_REVIEW_REQUIRED' }
}

export function getSocialFinanceCapabilityAvailability(capability: SocialFinanceCapability): {
  state: 'NOT_AVAILABLE'
  reason: 'PROVIDER_PROTOCOL_AND_USER_PROTECTION_REVIEW_REQUIRED'
} {
  return unavailableCapabilities[capability]
}
