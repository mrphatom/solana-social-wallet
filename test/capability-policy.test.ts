import { describe, expect, it } from 'vitest'

import { getCapabilityAvailability } from '../src/domain/capability-policy.js'

describe('Ecosystem capability policy', () => {
  it.each(['BUY', 'SELL', 'STAKE', 'BET'] as const)('reports %s as explicitly unavailable', (capability) => {
    expect(getCapabilityAvailability(capability)).toEqual({
      capability,
      state: 'NOT_AVAILABLE',
      reason: 'PROVIDER_AND_COMPLIANCE_REVIEW_REQUIRED'
    })
  })
})
