/**
 * Pure fee recommendation policy. It cannot query an oracle, modify a transaction, select a
 * route, request a wallet signature, or submit a transaction. See docs/transaction-fee-policy.md.
 */
export interface FeeSimulationEvidence {
  didSucceed: boolean
  messageFingerprint: string
  unitsConsumed: bigint
}

export interface PriorityFeeRequest {
  messageFingerprint: string
  routeFingerprint: string
  format: 'LEGACY' | 'V0' | 'V1'
  simulation: FeeSimulationEvidence
  userMaximumComputeUnitPriceMicroLamports: bigint
  userMaximumPriorityFeeLamports: bigint
}

export interface PriorityFeeObservation {
  providerId: string
  failureDomain: string
  observedAt: string
  slot: bigint
  microLamportsPerComputeUnit: bigint
}

export interface PriorityFeePolicy {
  now: string
  maxObservationAgeMs: bigint
  minIndependentFailureDomains: number
  percentile: bigint
  simulationSafetyMarginBps: bigint
  maxComputeUnitLimit: bigint
  maxComputeUnitPriceMicroLamports: bigint
  maxPriorityFeeLamports: bigint
}

export type PriorityFeeDecision =
  | {
      kind: 'RECOMMENDATION_AVAILABLE'
      messageFingerprint: string
      routeFingerprint: string
      computeUnitLimit: bigint
      recommendedComputeUnitPriceMicroLamports: bigint
      recommendedPriorityFeeLamports: bigint
    }
  | {
      kind: 'FEE_POLICY_UNAVAILABLE'
      reason:
        | 'FEE_OBSERVATIONS_STALE'
        | 'INDEPENDENT_FEE_EVIDENCE_REQUIRED'
        | 'SIMULATION_REQUIRED'
        | 'TRANSACTION_FORMAT_NOT_SUPPORTED'
        | 'COMPUTE_LIMIT_UNAVAILABLE'
    }
  | { kind: 'MESSAGE_OR_ROUTE_STALE'; reason: 'MESSAGE_FINGERPRINT_MISMATCH' }
  | { kind: 'FEE_CAP_TOO_LOW' }

function calculateCeilingDivision(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator
}

function isFresh(observedAt: string, now: string, maxAgeMs: bigint): boolean {
  const observedAtMs = Date.parse(observedAt)
  const nowMs = Date.parse(now)
  if (!Number.isFinite(observedAtMs) || !Number.isFinite(nowMs) || maxAgeMs < 0n) {
    return false
  }
  const ageMs = BigInt(nowMs - observedAtMs)
  return ageMs >= 0n && ageMs <= maxAgeMs
}

function hasIndependentFeeEvidence(observations: PriorityFeeObservation[], policy: PriorityFeePolicy): boolean {
  if (!Number.isSafeInteger(policy.minIndependentFailureDomains) || policy.minIndependentFailureDomains < 2) {
    return false
  }

  const sources = new Map<string, string>()
  for (const observation of observations) {
    if (!observation.providerId || !observation.failureDomain || observation.slot < 0n || observation.microLamportsPerComputeUnit < 0n) {
      return false
    }
    if (!sources.has(observation.providerId)) {
      sources.set(observation.providerId, observation.failureDomain)
    }
  }

  return new Set(sources.values()).size >= policy.minIndependentFailureDomains
}

function selectPercentile(values: bigint[], percentile: bigint): bigint | null {
  if (values.length === 0 || percentile < 0n || percentile > 100n) {
    return null
  }
  const sorted = [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
  const index = Number((BigInt(sorted.length - 1) * percentile) / 100n)
  return sorted[index] ?? null
}

export function evaluatePriorityFeeRecommendation(input: {
  request: PriorityFeeRequest
  observations: PriorityFeeObservation[]
  policy: PriorityFeePolicy
}): PriorityFeeDecision {
  const { request, observations, policy } = input

  if (!request.simulation.didSucceed || request.simulation.unitsConsumed <= 0n) {
    return { kind: 'FEE_POLICY_UNAVAILABLE', reason: 'SIMULATION_REQUIRED' }
  }
  if (request.simulation.messageFingerprint !== request.messageFingerprint) {
    return { kind: 'MESSAGE_OR_ROUTE_STALE', reason: 'MESSAGE_FINGERPRINT_MISMATCH' }
  }
  if (request.format !== 'LEGACY' && request.format !== 'V0') {
    return { kind: 'FEE_POLICY_UNAVAILABLE', reason: 'TRANSACTION_FORMAT_NOT_SUPPORTED' }
  }
  if (!observations.every((observation) => isFresh(observation.observedAt, policy.now, policy.maxObservationAgeMs))) {
    return { kind: 'FEE_POLICY_UNAVAILABLE', reason: 'FEE_OBSERVATIONS_STALE' }
  }
  if (!hasIndependentFeeEvidence(observations, policy)) {
    return { kind: 'FEE_POLICY_UNAVAILABLE', reason: 'INDEPENDENT_FEE_EVIDENCE_REQUIRED' }
  }

  const computeUnitLimit = calculateCeilingDivision(
    request.simulation.unitsConsumed * (10_000n + policy.simulationSafetyMarginBps),
    10_000n
  )
  if (computeUnitLimit <= 0n || computeUnitLimit > policy.maxComputeUnitLimit) {
    return { kind: 'FEE_POLICY_UNAVAILABLE', reason: 'COMPUTE_LIMIT_UNAVAILABLE' }
  }

  const selectedPrice = selectPercentile(
    observations.map((observation) => observation.microLamportsPerComputeUnit),
    policy.percentile
  )
  if (selectedPrice === null) {
    return { kind: 'FEE_POLICY_UNAVAILABLE', reason: 'INDEPENDENT_FEE_EVIDENCE_REQUIRED' }
  }
  const recommendedPriorityFeeLamports = calculateCeilingDivision(computeUnitLimit * selectedPrice, 1_000_000n)

  if (
    selectedPrice > policy.maxComputeUnitPriceMicroLamports ||
    selectedPrice > request.userMaximumComputeUnitPriceMicroLamports ||
    recommendedPriorityFeeLamports > policy.maxPriorityFeeLamports ||
    recommendedPriorityFeeLamports > request.userMaximumPriorityFeeLamports
  ) {
    return { kind: 'FEE_CAP_TOO_LOW' }
  }

  return {
    kind: 'RECOMMENDATION_AVAILABLE',
    messageFingerprint: request.messageFingerprint,
    routeFingerprint: request.routeFingerprint,
    computeUnitLimit,
    recommendedComputeUnitPriceMicroLamports: selectedPrice,
    recommendedPriorityFeeLamports
  }
}
