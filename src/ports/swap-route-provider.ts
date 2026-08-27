import type { RouteSourceEvidence, SwapQuoteEvidence } from '../domain/swap-routing-policy.js'

/**
 * Future adapter contract only. A provider result is untrusted evidence and must pass the local
 * swap-routing policy before display. This port intentionally has no route-selection, transaction
 * construction, wallet, signing, submission, or execution method.
 */
export interface UntrustedSwapRouteEnvelope {
  quote: SwapQuoteEvidence
  source: RouteSourceEvidence
  routeFingerprint: string
  serializedCandidateMessage: Uint8Array
}

export interface SwapRouteEvidenceProvider {
  getUntrustedRouteEvidence(requestId: string): Promise<UntrustedSwapRouteEnvelope[]>
}
