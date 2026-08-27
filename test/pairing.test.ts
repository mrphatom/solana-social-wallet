import { describe, expect, it } from 'vitest'

import { MemorySocialRepository } from '../src/adapters/memory-social-repository.js'
import { createAccountService } from '../src/application/account-service.js'

describe('AccountService pairing', () => {
  it('links a verified Telegram identity only after the source Discord identity confirms the pairing request', async () => {
    const service = createAccountService({
      repository: new MemorySocialRepository(),
      clock: () => new Date('2026-08-27T12:00:00.000Z'),
      codeGenerator: () => 'paired-test-code'
    })

    const account = await service.createAccountFromIdentity({
      platform: 'discord',
      platformUserId: 'discord-user-100',
      displayName: 'sender'
    })

    const pairing = await service.issuePairingCode({
      actor: { platform: 'discord', platformUserId: 'discord-user-100' },
      targetPlatform: 'telegram'
    })

    const request = await service.requestPairing({
      actor: { platform: 'telegram', platformUserId: 'telegram-user-200' },
      code: pairing.code
    })

    expect(request.status).toBe('AWAITING_SOURCE_CONFIRMATION')
    expect(
      await service.getAccountForIdentity({
        platform: 'telegram',
        platformUserId: 'telegram-user-200'
      })
    ).toBeNull()

    await service.confirmPairingRequest({
      actor: { platform: 'discord', platformUserId: 'discord-user-100' },
      requestId: request.id
    })

    const sharedAccount = await service.getAccountForIdentity({
      platform: 'telegram',
      platformUserId: 'telegram-user-200'
    })

    expect(sharedAccount?.id).toBe(account.id)
    expect(sharedAccount?.identities).toHaveLength(2)
    expect(sharedAccount?.identities.map((identity) => identity.platform)).toEqual(['discord', 'telegram'])
  })

  it('refuses a pairing code that targets the source chat platform', async () => {
    const service = createAccountService({
      repository: new MemorySocialRepository(),
      clock: () => new Date('2026-08-27T12:00:00.000Z'),
      codeGenerator: () => 'paired-test-code'
    })

    await service.createAccountFromIdentity({
      platform: 'discord',
      platformUserId: 'discord-user-300',
      displayName: 'sender'
    })

    await expect(
      service.issuePairingCode({
        actor: { platform: 'discord', platformUserId: 'discord-user-300' },
        targetPlatform: 'discord'
      })
    ).rejects.toMatchObject({ code: 'PAIRING_TARGET_PLATFORM_MUST_DIFFER' })
  })
})
