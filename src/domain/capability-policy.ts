export const ecosystemCapabilities = ['BUY', 'SELL', 'STAKE', 'BET'] as const

export type EcosystemCapability = (typeof ecosystemCapabilities)[number]

export interface CapabilityAvailability {
  capability: EcosystemCapability
  state: 'NOT_AVAILABLE'
  reason: 'PROVIDER_AND_COMPLIANCE_REVIEW_REQUIRED'
}

/**
 * These responses are executable safety policy, not a placeholder integration.
 * A future provider must replace this through a separately reviewed adapter.
 */
export function getCapabilityAvailability(capability: EcosystemCapability): CapabilityAvailability {
  return {
    capability,
    state: 'NOT_AVAILABLE',
    reason: 'PROVIDER_AND_COMPLIANCE_REVIEW_REQUIRED'
  }
}
