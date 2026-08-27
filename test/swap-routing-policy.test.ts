import { describe, expect, it } from 'vitest'

import { evaluateSwapRouteRequest } from '../src/domain/swap-routing-policy.js'

const request = {
  kind: 'SWAP_ROUTE_REQUEST_V1' as const,
  requestId: 'swap-request-1',
  network: 'solana:mainnet' as const,
  inputMint: 'MintInput111111111111111111111111111111111',
  outputMint: 'MintOutput11111111111111111111111111111111',
  inputAmountBaseUnits: 1_000_000n,
  minimumOutputBaseUnits: 900_000n,
  maxSlippageBps: 100n,
  expiresAt: '2026-08-27T12:05:00.000Z'
}

const evidence = {
  routeFingerprint: 'sha256:route-1',
  quote: {
    requestId: 'swap-request-1',
    inputMint: 'MintInput111111111111111111111111111111111',
    outputMint: 'MintOutput11111111111111111111111111111111',
    inputAmountBaseUnits: 1_000_000n,
    expectedOutputBaseUnits: 950_000n,
    minimumOutputBaseUnits: 900_000n,
    declaredPriceImpactBps: 80n,
    expiresAt: '2026-08-27T12:05:00.000Z'
  },
  routeSources: [
    { providerId: 'provider-a', failureDomain: 'provider-domain-a', routeFingerprint: 'sha256:route-1', isSignatureValid: true },
    { providerId: 'provider-b', failureDomain: 'provider-domain-b', routeFingerprint: 'sha256:route-1', isSignatureValid: true }
  ],
  decodedMessage: {
    format: 'V0' as const,
    fingerprint: 'sha256:route-1',
    feePayer: 'Wallet111111111111111111111111111111111111',
    hasUnexpectedTransferAuthority: false,
    hasUnknownAccountRole: false,
    instructions: [
      { programId: 'DexProgram11111111111111111111111111111111', effect: 'SWAP_EXECUTION' as const },
      { programId: 'ComputeBudget11111111111111111111111111111', effect: 'COMPUTE_BUDGET' as const }
    ],
    addressLookupTables: [
      { address: 'Alt111111111111111111111111111111111111', isResolved: true, hasUnknownAddressRole: false }
    ]
  },
  mintEvidence: [
    { mint: 'MintInput111111111111111111111111111111111', tokenProgram: 'TOKEN', extensions: [] },
    { mint: 'MintOutput11111111111111111111111111111111', tokenProgram: 'TOKEN_2022', extensions: ['TRANSFER_FEE_CONFIG'] }
  ],
  simulation: {
    didSucceed: true,
    messageFingerprint: 'sha256:route-1',
    commitment: 'confirmed' as const,
    hasUnknownInnerInstruction: false,
    hasUnexpectedBalanceEffect: false
  },
  computeBudget: {
    computeUnitLimit: 220_000n,
    computeUnitPriceMicroLamports: 5_000n,
    totalPriorityFeeLamports: 1_100n
  }
}

const policy = {
  now: '2026-08-27T12:00:00.000Z',
  minIndependentRouteSources: 2,
  maxPriceImpactBps: 150n,
  maxComputeUnitLimit: 300_000n,
  maxComputeUnitPriceMicroLamports: 10_000n,
  maxPriorityFeeLamports: 2_000n,
  allowedPrograms: ['DexProgram11111111111111111111111111111111', 'ComputeBudget11111111111111111111111111111'],
  allowedTokenPrograms: ['TOKEN', 'TOKEN_2022'],
  allowedToken2022Extensions: ['TRANSFER_FEE_CONFIG']
}

describe('swap route request policy', () => {
  it('accepts only independently corroborated, fully decoded, intent-bound, fresh, simulated routes for human review', () => {
    expect(evaluateSwapRouteRequest({ request, evidence, policy })).toEqual({
      kind: 'ROUTE_ACCEPTED_FOR_HUMAN_REVIEW',
      routeFingerprint: 'sha256:route-1',
      expectedOutputBaseUnits: 950_000n,
      minimumOutputBaseUnits: 900_000n
    })
  })

  it('fails closed when quotes, route fingerprints, mints, amounts, or minimum outputs do not bind to the requested swap', () => {
    expect(
      evaluateSwapRouteRequest({
        request,
        evidence: { ...evidence, routeFingerprint: 'sha256:substituted-route' },
        policy
      })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'ROUTE_FINGERPRINT_MISMATCH' })

    expect(
      evaluateSwapRouteRequest({
        request,
        evidence: { ...evidence, quote: { ...evidence.quote, inputAmountBaseUnits: 1_000_001n } },
        policy
      })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'INTENT_MISMATCH' })

    expect(
      evaluateSwapRouteRequest({
        request,
        evidence: { ...evidence, quote: { ...evidence.quote, minimumOutputBaseUnits: 899_999n } },
        policy
      })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'INTENT_MISMATCH' })
  })

  it('refuses expired quotes, invalid slippage values, and price impact beyond the explicit user-policy limit', () => {
    expect(
      evaluateSwapRouteRequest({
        request,
        evidence: { ...evidence, quote: { ...evidence.quote, expiresAt: '2026-08-27T11:59:59.000Z' } },
        policy
      })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'QUOTE_STALE' })

    expect(evaluateSwapRouteRequest({ request: { ...request, maxSlippageBps: 0n }, evidence, policy })).toEqual({
      kind: 'ROUTE_REJECTED',
      reason: 'OUTPUT_OR_SLIPPAGE_INVALID'
    })

    expect(
      evaluateSwapRouteRequest({
        request,
        evidence: { ...evidence, quote: { ...evidence.quote, declaredPriceImpactBps: 151n } },
        policy
      })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'OUTPUT_OR_SLIPPAGE_INVALID' })
  })

  it('rejects a single route source, duplicate failure domains, opaque instructions, program substitution, unknown account roles, and unknown token extensions', () => {
    expect(
      evaluateSwapRouteRequest({ request, evidence: { ...evidence, routeSources: [evidence.routeSources[0]] }, policy })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'INDEPENDENT_ROUTE_EVIDENCE_REQUIRED' })

    expect(
      evaluateSwapRouteRequest({
        request,
        evidence: {
          ...evidence,
          routeSources: [evidence.routeSources[0], { ...evidence.routeSources[1], failureDomain: 'provider-domain-a' }]
        },
        policy
      })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'INDEPENDENT_ROUTE_EVIDENCE_REQUIRED' })

    expect(
      evaluateSwapRouteRequest({
        request,
        evidence: {
          ...evidence,
          decodedMessage: {
            ...evidence.decodedMessage,
            instructions: [{ programId: 'UnknownProgram1111111111111111111111111111111', effect: 'OPAQUE' }]
          }
        },
        policy
      })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'PROGRAM_OR_EXTENSION_NOT_ALLOWED' })

    expect(
      evaluateSwapRouteRequest({
        request,
        evidence: { ...evidence, decodedMessage: { ...evidence.decodedMessage, hasUnknownAccountRole: true } },
        policy
      })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'HIDDEN_OR_UNEXPECTED_EFFECT' })

    expect(
      evaluateSwapRouteRequest({
        request,
        evidence: {
          ...evidence,
          mintEvidence: [
            ...evidence.mintEvidence,
            { mint: 'MintOutput11111111111111111111111111111111', tokenProgram: 'TOKEN_2022', extensions: ['PERMANENT_DELEGATE'] }
          ]
        },
        policy
      })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'PROGRAM_OR_EXTENSION_NOT_ALLOWED' })
  })

  it('refuses stale simulation, unexpected transfer authority, and compute-budget limits or fees outside user policy', () => {
    expect(
      evaluateSwapRouteRequest({
        request,
        evidence: { ...evidence, simulation: { ...evidence.simulation, messageFingerprint: 'sha256:prior-message' } },
        policy
      })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'SIMULATION_REVIEW_REQUIRED' })

    expect(
      evaluateSwapRouteRequest({
        request,
        evidence: { ...evidence, decodedMessage: { ...evidence.decodedMessage, hasUnexpectedTransferAuthority: true } },
        policy
      })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'HIDDEN_OR_UNEXPECTED_EFFECT' })

    expect(
      evaluateSwapRouteRequest({
        request,
        evidence: { ...evidence, computeBudget: { ...evidence.computeBudget, computeUnitPriceMicroLamports: 10_001n } },
        policy
      })
    ).toEqual({ kind: 'ROUTE_REJECTED', reason: 'COMPUTE_BUDGET_OUT_OF_BOUNDS' })
  })
})
