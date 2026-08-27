import { describe, expect, it } from 'vitest'

import { MemorySocialRepository } from '../src/adapters/memory-social-repository.js'
import { createLocalChatRuntime } from '../src/adapters/local-chat-runtime.js'
import { createAccountService } from '../src/application/account-service.js'

describe('Local cross-platform chat runtime', () => {
  it('routes Discord and Telegram pairing commands through the same source-confirmed account service', async () => {
    const repository = new MemorySocialRepository()
    const accounts = createAccountService({
      repository,
      clock: () => new Date('2026-08-27T12:00:00.000Z'),
      codeGenerator: () => 'paired-test-code'
    })
    const runtime = createLocalChatRuntime({ accounts })

    const created = await runtime.handle({
      platform: 'discord',
      platformUserId: 'discord-user-100',
      displayName: 'sender',
      command: { type: 'CREATE_ACCOUNT' }
    })
    expect(created.kind).toBe('ACCOUNT_CREATED')

    const pairing = await runtime.handle({
      platform: 'discord',
      platformUserId: 'discord-user-100',
      displayName: 'sender',
      command: { type: 'ISSUE_PAIRING', targetPlatform: 'telegram' }
    })
    expect(pairing.kind).toBe('PAIRING_CODE_ISSUED')
    if (pairing.kind !== 'PAIRING_CODE_ISSUED') throw new Error('Expected pairing code response.')

    const pending = await runtime.handle({
      platform: 'telegram',
      platformUserId: 'telegram-user-200',
      displayName: 'recipient',
      command: { type: 'REQUEST_PAIRING', code: pairing.code }
    })
    expect(pending.kind).toBe('PAIRING_CONFIRMATION_PENDING')
    if (pending.kind !== 'PAIRING_CONFIRMATION_PENDING') throw new Error('Expected pending pairing response.')

    const confirmed = await runtime.handle({
      platform: 'discord',
      platformUserId: 'discord-user-100',
      displayName: 'sender',
      command: { type: 'CONFIRM_PAIRING', requestId: pending.requestId }
    })

    expect(confirmed).toEqual({ kind: 'PAIRING_CONFIRMED' })
  })
})
