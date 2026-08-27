import type { PriorityFeeObservation } from '../domain/priority-fee-policy.js'

/**
 * Future adapter contract only. Observations are historical inputs to a local policy and are never
 * permission to alter a reviewed message, charge a user, or submit a transaction.
 */
export interface PriorityFeeObservationOracle {
  getUntrustedPriorityFeeObservations(scopeFingerprint: string): Promise<PriorityFeeObservation[]>
}
