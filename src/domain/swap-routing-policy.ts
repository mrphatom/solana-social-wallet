/**
 * Architecture-only policy for future swap-route review. It evaluates supplied evidence but
 * deliberately has no transport, wallet, signer, transaction-builder, or execution capability.
 * See docs/secure-swap-routing-and-fee-policy.md before adding an adapter.
 */
export interface SwapRouteRequest {
  kind: 'SWAP_ROUTE_REQUEST_V1'
  requestId: string
  network: 'solana:mainnet' | 'solana:devnet'
  inputMint: string
  outputMint: string
  inputAmountBaseUnits: bigint
  minimumOutputBaseUnits: bigint
  maxSlippageBps: bigint
  expiresAt: string
}

export interface SwapQuoteEvidence {
  requestId: string
  inputMint: string
  outputMint: string
  inputAmountBaseUnits: bigint
  expectedOutputBaseUnits: bigint
  minimumOutputBaseUnits: bigint
  declaredPriceImpactBps: bigint
  expiresAt: string
}

export interface RouteSourceEvidence {
  providerId: string
  failureDomain: string
  routeFingerprint: string
  isSignatureValid: boolean
}

export type DecodedInstructionEffect = 'SWAP_EXECUTION' | 'COMPUTE_BUDGET' | 'TOKEN_TRANSFER' | 'OPAQUE'

export interface DecodedSwapMessageEvidence {
  format: 'LEGACY' | 'V0'
  fingerprint: string
  feePayer: string
  hasUnexpectedTransferAuthority: boolean
  hasUnknownAccountRole: boolean
  instructions: Array<{ programId: string; effect: DecodedInstructionEffect }>
  addressLookupTables: Array<{ address: string; isResolved: boolean; hasUnknownAddressRole: boolean }>
}

export type TokenProgramKind = 'TOKEN' | 'TOKEN_2022'

export interface MintEvidence {
  mint: string
  tokenProgram: TokenProgramKind
  extensions: string[]
}

export interface RouteSimulationEvidence {
  didSucceed: boolean
  messageFingerprint: string
  commitment: 'processed' | 'confirmed' | 'finalized'
  hasUnknownInnerInstruction: boolean
  hasUnexpectedBalanceEffect: boolean
}

export interface ComputeBudgetEvidence {
  computeUnitLimit: bigint
  computeUnitPriceMicroLamports: bigint
  totalPriorityFeeLamports: bigint
}

export interface SwapRouteEvidence {
  routeFingerprint: string
  quote: SwapQuoteEvidence
  routeSources: RouteSourceEvidence[]
  decodedMessage: DecodedSwapMessageEvidence
  mintEvidence: MintEvidence[]
  simulation: RouteSimulationEvidence
  computeBudget: ComputeBudgetEvidence
}

export interface SwapRoutingPolicy {
  now: string
  minIndependentRouteSources: number
  maxPriceImpactBps: bigint
  maxComputeUnitLimit: bigint
  maxComputeUnitPriceMicroLamports: bigint
  maxPriorityFeeLamports: bigint
  allowedPrograms: string[]
  allowedTokenPrograms: TokenProgramKind[]
  allowedToken2022Extensions: string[]
}

export type SwapRouteDecision =
  | {
      kind: 'ROUTE_ACCEPTED_FOR_HUMAN_REVIEW'
      routeFingerprint: string
      expectedOutputBaseUnits: bigint
      minimumOutputBaseUnits: bigint
    }
  | {
      kind: 'ROUTE_REJECTED'
      reason:
        | 'ROUTE_FINGERPRINT_MISMATCH'
        | 'INTENT_MISMATCH'
        | 'QUOTE_STALE'
        | 'OUTPUT_OR_SLIPPAGE_INVALID'
        | 'INDEPENDENT_ROUTE_EVIDENCE_REQUIRED'
        | 'PROGRAM_OR_EXTENSION_NOT_ALLOWED'
        | 'HIDDEN_OR_UNEXPECTED_EFFECT'
        | 'SIMULATION_REVIEW_REQUIRED'
        | 'COMPUTE_BUDGET_OUT_OF_BOUNDS'
    }

function isExpired(expiresAt: string, now: string): boolean {
  const expiresAtMs = Date.parse(expiresAt)
  const nowMs = Date.parse(now)
  return !Number.isFinite(expiresAtMs) || !Number.isFinite(nowMs) || expiresAtMs <= nowMs
}

function routeSourcesAreIndependent(evidence: SwapRouteEvidence, policy: SwapRoutingPolicy): boolean {
  if (!Number.isSafeInteger(policy.minIndependentRouteSources) || policy.minIndependentRouteSources < 2) {
    return false
  }

  const distinctSources = new Map<string, string>()
  for (const source of evidence.routeSources) {
    if (!source.isSignatureValid || source.routeFingerprint !== evidence.routeFingerprint) {
      continue
    }
    if (!source.providerId || !source.failureDomain || distinctSources.has(source.providerId)) {
      continue
    }
    distinctSources.set(source.providerId, source.failureDomain)
  }

  return new Set(distinctSources.values()).size >= policy.minIndependentRouteSources
}

function hasAllowedMints(request: SwapRouteRequest, evidence: SwapRouteEvidence, policy: SwapRoutingPolicy): boolean {
  const expectedMints = new Set([request.inputMint, request.outputMint])
  const coveredMints = new Set<string>()

  for (const mint of evidence.mintEvidence) {
    if (!expectedMints.has(mint.mint) || !policy.allowedTokenPrograms.includes(mint.tokenProgram)) {
      return false
    }
    if (mint.tokenProgram === 'TOKEN_2022' && mint.extensions.some((extension) => !policy.allowedToken2022Extensions.includes(extension))) {
      return false
    }
    coveredMints.add(mint.mint)
  }

  return coveredMints.size === expectedMints.size
}

function computeBudgetIsWithinPolicy(computeBudget: ComputeBudgetEvidence, policy: SwapRoutingPolicy): boolean {
  return (
    computeBudget.computeUnitLimit > 0n &&
    computeBudget.computeUnitLimit <= policy.maxComputeUnitLimit &&
    computeBudget.computeUnitPriceMicroLamports >= 0n &&
    computeBudget.computeUnitPriceMicroLamports <= policy.maxComputeUnitPriceMicroLamports &&
    computeBudget.totalPriorityFeeLamports >= 0n &&
    computeBudget.totalPriorityFeeLamports <= policy.maxPriorityFeeLamports
  )
}

export function evaluateSwapRouteRequest(input: {
  request: SwapRouteRequest
  evidence: SwapRouteEvidence
  policy: SwapRoutingPolicy
}): SwapRouteDecision {
  const { request, evidence, policy } = input

  if (evidence.routeFingerprint !== evidence.decodedMessage.fingerprint) {
    return { kind: 'ROUTE_REJECTED', reason: 'ROUTE_FINGERPRINT_MISMATCH' }
  }

  if (
    request.inputAmountBaseUnits <= 0n ||
    request.minimumOutputBaseUnits <= 0n ||
    request.maxSlippageBps <= 0n ||
    evidence.quote.expectedOutputBaseUnits <= 0n ||
    evidence.quote.minimumOutputBaseUnits <= 0n ||
    evidence.quote.declaredPriceImpactBps < 0n ||
    evidence.quote.declaredPriceImpactBps > policy.maxPriceImpactBps ||
    evidence.quote.expectedOutputBaseUnits < evidence.quote.minimumOutputBaseUnits
  ) {
    return { kind: 'ROUTE_REJECTED', reason: 'OUTPUT_OR_SLIPPAGE_INVALID' }
  }

  if (isExpired(request.expiresAt, policy.now) || isExpired(evidence.quote.expiresAt, policy.now)) {
    return { kind: 'ROUTE_REJECTED', reason: 'QUOTE_STALE' }
  }

  if (
    evidence.quote.requestId !== request.requestId ||
    evidence.quote.inputMint !== request.inputMint ||
    evidence.quote.outputMint !== request.outputMint ||
    evidence.quote.inputAmountBaseUnits !== request.inputAmountBaseUnits ||
    evidence.quote.minimumOutputBaseUnits !== request.minimumOutputBaseUnits
  ) {
    return { kind: 'ROUTE_REJECTED', reason: 'INTENT_MISMATCH' }
  }

  if (!routeSourcesAreIndependent(evidence, policy)) {
    return { kind: 'ROUTE_REJECTED', reason: 'INDEPENDENT_ROUTE_EVIDENCE_REQUIRED' }
  }

  if (
    !evidence.decodedMessage.feePayer ||
    evidence.decodedMessage.instructions.length === 0 ||
    evidence.decodedMessage.instructions.some(
      (instruction) => instruction.effect === 'OPAQUE' || !policy.allowedPrograms.includes(instruction.programId)
    ) ||
    !hasAllowedMints(request, evidence, policy)
  ) {
    return { kind: 'ROUTE_REJECTED', reason: 'PROGRAM_OR_EXTENSION_NOT_ALLOWED' }
  }

  if (
    evidence.decodedMessage.hasUnexpectedTransferAuthority ||
    evidence.decodedMessage.hasUnknownAccountRole ||
    evidence.decodedMessage.addressLookupTables.some((lookupTable) => !lookupTable.isResolved || lookupTable.hasUnknownAddressRole)
  ) {
    return { kind: 'ROUTE_REJECTED', reason: 'HIDDEN_OR_UNEXPECTED_EFFECT' }
  }

  if (
    !evidence.simulation.didSucceed ||
    evidence.simulation.messageFingerprint !== evidence.routeFingerprint ||
    evidence.simulation.hasUnknownInnerInstruction ||
    evidence.simulation.hasUnexpectedBalanceEffect
  ) {
    return { kind: 'ROUTE_REJECTED', reason: 'SIMULATION_REVIEW_REQUIRED' }
  }

  if (!computeBudgetIsWithinPolicy(evidence.computeBudget, policy)) {
    return { kind: 'ROUTE_REJECTED', reason: 'COMPUTE_BUDGET_OUT_OF_BOUNDS' }
  }

  return {
    kind: 'ROUTE_ACCEPTED_FOR_HUMAN_REVIEW',
    routeFingerprint: evidence.routeFingerprint,
    expectedOutputBaseUnits: evidence.quote.expectedOutputBaseUnits,
    minimumOutputBaseUnits: evidence.quote.minimumOutputBaseUnits
  }
}
