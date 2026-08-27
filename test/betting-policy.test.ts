import { describe, expect, it } from 'vitest'

import { evaluateBettingCapability } from '../src/domain/betting-policy.js'

describe('betting transaction policy', () => {
  it('keeps protocol-agnostic betting requests unavailable until a separately reviewed provider, compliance, and protection profile exists', () => {
    expect(evaluateBettingCapability()).toEqual({
      state: 'NOT_AVAILABLE',
      reason: 'PROTOCOL_COMPLIANCE_AND_PROTECTION_REVIEW_REQUIRED'
    })
  })
})
