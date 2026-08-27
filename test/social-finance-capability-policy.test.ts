import { describe, expect, it } from 'vitest'

import { getSocialFinanceCapabilityAvailability } from '../src/domain/social-finance-capability-policy.js'

describe('social-finance capability policy', () => {
  it('keeps portfolio, native stake, liquid stake, liquidity-position, and reward-claim actions disabled pending protocol, provider, and user-protection review', () => {
    for (const capability of ['PORTFOLIO_SNAPSHOT', 'NATIVE_SOL_STAKE', 'LIQUID_STAKE', 'LIQUIDITY_POSITION', 'REWARD_CLAIM'] as const) {
      expect(getSocialFinanceCapabilityAvailability(capability)).toEqual({
        state: 'NOT_AVAILABLE',
        reason: 'PROVIDER_PROTOCOL_AND_USER_PROTECTION_REVIEW_REQUIRED'
      })
    }
  })
})
