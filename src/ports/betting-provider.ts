/**
 * Future profile contract only. It has no wagering or transaction method because betting is
 * deliberately unavailable until a separate provider, compliance, and protection review passes.
 */
export interface UntrustedBettingProviderProfile {
  providerId: string
  jurisdictionPolicyVersion: string
  protocolProfileVersion: string
  marketLifecyclePolicyVersion: string
}

export interface BettingProviderProfileSource {
  getUntrustedProfile(providerId: string): Promise<UntrustedBettingProviderProfile | null>
}
