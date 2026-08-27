import { describe, expect, it } from 'vitest'

import { evaluatePriorityFeeRecommendation } from '../src/domain/priority-fee-policy.js'

const policy = {
  now: '2026-08-27T12:00:00.000Z',
  maxObservationAgeMs: 30_000n,
  minIndependentFailureDomains: 2,
  percentile: 75n,
  simulationSafetyMarginBps: 1_000n,
  maxComputeUnitLimit: 300_000n,
  maxComputeUnitPriceMicroLamports: 10_000n,
  maxPriorityFeeLamports: 2_000n
}

const request = {
  messageFingerprint: 'sha256:message-1',
  routeFingerprint: 'sha256:route-1',
  format: 'V0' as const,
  simulation: {
    didSucceed: true,
    messageFingerprint: 'sha256:message-1',
    unitsConsumed: 200_000n
  },
  userMaximumComputeUnitPriceMicroLamports: 10_000n,
  userMaximumPriorityFeeLamports: 2_000n
}

const observations = [
  { providerId: 'oracle-a', failureDomain: 'oracle-domain-a', observedAt: '2026-08-27T11:59:45.000Z', slot: 1_000n, microLamportsPerComputeUnit: 4_000n },
  { providerId: 'oracle-b', failureDomain: 'oracle-domain-b', observedAt: '2026-08-27T11:59:46.000Z', slot: 1_001n, microLamportsPerComputeUnit: 5_000n },
  { providerId: 'oracle-c', failureDomain: 'oracle-domain-c', observedAt: '2026-08-27T11:59:47.000Z', slot: 1_002n, microLamportsPerComputeUnit: 6_000n },
  { providerId: 'oracle-d', failureDomain: 'oracle-domain-d', observedAt: '2026-08-27T11:59:48.000Z', slot: 1_003n, microLamportsPerComputeUnit: 7_000n }
]

describe('priority fee policy', () => {
  it('returns a bounded recommendation bound to one current simulated legacy/v0 message without mutating it', () => {
    expect(evaluatePriorityFeeRecommendation({ request, observations, policy })).toEqual({
      kind: 'RECOMMENDATION_AVAILABLE',
      messageFingerprint: 'sha256:message-1',
      routeFingerprint: 'sha256:route-1',
      computeUnitLimit: 220_000n,
      recommendedComputeUnitPriceMicroLamports: 6_000n,
      recommendedPriorityFeeLamports: 1_320n
    })
  })

  it('returns unavailable rather than guessing when observations are stale, malformed, or lack independent failure domains', () => {
    expect(
      evaluatePriorityFeeRecommendation({
        request,
        observations: observations.map((observation) => ({ ...observation, observedAt: '2026-08-27T11:00:00.000Z' })),
        policy
      })
    ).toEqual({ kind: 'FEE_POLICY_UNAVAILABLE', reason: 'FEE_OBSERVATIONS_STALE' })

    expect(
      evaluatePriorityFeeRecommendation({
        request,
        observations: [observations[0], { ...observations[1], failureDomain: 'oracle-domain-a' }],
        policy
      })
    ).toEqual({ kind: 'FEE_POLICY_UNAVAILABLE', reason: 'INDEPENDENT_FEE_EVIDENCE_REQUIRED' })
  })

  it('refuses missing simulation, mismatched fingerprints, unsafe compute estimates, unsupported formats, and user-policy fee caps', () => {
    expect(
      evaluatePriorityFeeRecommendation({ request: { ...request, simulation: { ...request.simulation, didSucceed: false } }, observations, policy })
    ).toEqual({ kind: 'FEE_POLICY_UNAVAILABLE', reason: 'SIMULATION_REQUIRED' })

    expect(
      evaluatePriorityFeeRecommendation({
        request: { ...request, simulation: { ...request.simulation, messageFingerprint: 'sha256:different-message' } },
        observations,
        policy
      })
    ).toEqual({ kind: 'MESSAGE_OR_ROUTE_STALE', reason: 'MESSAGE_FINGERPRINT_MISMATCH' })

    expect(
      evaluatePriorityFeeRecommendation({ request: { ...request, format: 'V1' as const }, observations, policy })
    ).toEqual({ kind: 'FEE_POLICY_UNAVAILABLE', reason: 'TRANSACTION_FORMAT_NOT_SUPPORTED' })

    expect(
      evaluatePriorityFeeRecommendation({
        request: { ...request, simulation: { ...request.simulation, unitsConsumed: 300_000n } },
        observations,
        policy
      })
    ).toEqual({ kind: 'FEE_POLICY_UNAVAILABLE', reason: 'COMPUTE_LIMIT_UNAVAILABLE' })

    expect(
      evaluatePriorityFeeRecommendation({
        request: { ...request, userMaximumPriorityFeeLamports: 1_000n },
        observations,
        policy
      })
    ).toEqual({ kind: 'FEE_CAP_TOO_LOW' })
  })
})
