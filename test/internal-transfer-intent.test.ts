import { describe, expect, it } from 'vitest'

import { MemorySocialRepository } from '../src/adapters/memory-social-repository.js'
import { createAccountService } from '../src/application/account-service.js'
import { createInternalTransferIntentService } from '../src/application/internal-transfer-intent-service.js'
import { createWalletAccountService } from '../src/application/wallet-account-service.js'

const senderAddress = '11111111111111111111111111111111'
const recipientAddress = 'SysvarC1ock11111111111111111111111111111111'

describe('Internal transfer intents', () => {
  it('creates a recipient-bound Solana intent that remains awaiting wallet approval', async () => {
    const repository = new MemorySocialRepository()
    const clock = () => new Date('2026-08-27T12:00:00.000Z')
    const accounts = createAccountService({ repository, clock })
    const walletAccounts = createWalletAccountService({
      repository,
      clock,
      ownershipVerifier: { verify: async () => true }
    })
    const intents = createInternalTransferIntentService({ repository, clock, idGenerator: () => 'intent-00000000-0000-4000-8000-000000000001' })

    await accounts.createAccountFromIdentity({
      platform: 'discord',
      platformUserId: 'discord-sender',
      displayName: 'sender'
    })
    await accounts.createAccountFromIdentity({
      platform: 'telegram',
      platformUserId: 'telegram-recipient',
      displayName: 'recipient'
    })

    await walletAccounts.bindVerifiedWallet({
      actor: { platform: 'discord', platformUserId: 'discord-sender' },
      solanaAddress: senderAddress,
      proof: 'test-wallet-proof'
    })
    await walletAccounts.bindVerifiedWallet({
      actor: { platform: 'telegram', platformUserId: 'telegram-recipient' },
      solanaAddress: recipientAddress,
      proof: 'test-wallet-proof'
    })
    await walletAccounts.setInternalTransferOptIn({
      actor: { platform: 'telegram', platformUserId: 'telegram-recipient' },
      acceptsInternalTransfers: true
    })

    const intent = await intents.create({
      actor: { platform: 'discord', platformUserId: 'discord-sender' },
      recipient: { platform: 'telegram', platformUserId: 'telegram-recipient' },
      amountLamports: '2500000',
      idempotencyKey: 'internal-transfer-intent-0001'
    })

    expect(intent.state).toBe('AWAITING_WALLET_APPROVAL')
    expect(intent.recipient.solanaAddress).toBe(recipientAddress)
    expect(intent.amountLamports).toBe(2500000n)
    expect(intent.network).toBe('solana:devnet')
  })

  it('returns the existing intent for a repeated sender idempotency key instead of creating a second request', async () => {
    const repository = new MemorySocialRepository()
    const clock = () => new Date('2026-08-27T12:00:00.000Z')
    const accounts = createAccountService({ repository, clock })
    const walletAccounts = createWalletAccountService({ repository, clock, ownershipVerifier: { verify: async () => true } })
    const intents = createInternalTransferIntentService({ repository, clock })

    await accounts.createAccountFromIdentity({ platform: 'discord', platformUserId: 'discord-one', displayName: 'sender' })
    await accounts.createAccountFromIdentity({ platform: 'telegram', platformUserId: 'telegram-two', displayName: 'recipient' })
    await walletAccounts.bindVerifiedWallet({ actor: { platform: 'discord', platformUserId: 'discord-one' }, solanaAddress: senderAddress, proof: 'test-wallet-proof' })
    await walletAccounts.bindVerifiedWallet({ actor: { platform: 'telegram', platformUserId: 'telegram-two' }, solanaAddress: recipientAddress, proof: 'test-wallet-proof' })
    await walletAccounts.setInternalTransferOptIn({ actor: { platform: 'telegram', platformUserId: 'telegram-two' }, acceptsInternalTransfers: true })

    const input = {
      actor: { platform: 'discord' as const, platformUserId: 'discord-one' },
      recipient: { platform: 'telegram' as const, platformUserId: 'telegram-two' },
      amountLamports: '99',
      idempotencyKey: 'internal-transfer-intent-0002'
    }
    const first = await intents.create(input)
    const second = await intents.create(input)

    expect(second.id).toBe(first.id)
    expect(second.state).toBe('AWAITING_WALLET_APPROVAL')
  })

  it('refuses an internal recipient that has not explicitly opted in', async () => {
    const repository = new MemorySocialRepository()
    const clock = () => new Date('2026-08-27T12:00:00.000Z')
    const accounts = createAccountService({ repository, clock })
    const walletAccounts = createWalletAccountService({ repository, clock, ownershipVerifier: { verify: async () => true } })
    const intents = createInternalTransferIntentService({ repository, clock })

    await accounts.createAccountFromIdentity({ platform: 'discord', platformUserId: 'discord-three', displayName: 'sender' })
    await accounts.createAccountFromIdentity({ platform: 'telegram', platformUserId: 'telegram-four', displayName: 'recipient' })
    await walletAccounts.bindVerifiedWallet({ actor: { platform: 'discord', platformUserId: 'discord-three' }, solanaAddress: senderAddress, proof: 'test-wallet-proof' })
    await walletAccounts.bindVerifiedWallet({ actor: { platform: 'telegram', platformUserId: 'telegram-four' }, solanaAddress: recipientAddress, proof: 'test-wallet-proof' })

    await expect(
      intents.create({
        actor: { platform: 'discord', platformUserId: 'discord-three' },
        recipient: { platform: 'telegram', platformUserId: 'telegram-four' },
        amountLamports: '99',
        idempotencyKey: 'internal-transfer-intent-0003'
      })
    ).rejects.toMatchObject({ code: 'INTERNAL_TRANSFER_OPT_IN_REQUIRED' })
  })

  it('rejects an invalid Solana address before invoking the ownership verifier', async () => {
    let verificationCalls = 0
    const repository = new MemorySocialRepository()
    const accounts = createAccountService({ repository, clock: () => new Date('2026-08-27T12:00:00.000Z') })
    const walletAccounts = createWalletAccountService({
      repository,
      ownershipVerifier: {
        verify: async () => {
          verificationCalls += 1
          return true
        }
      }
    })
    await accounts.createAccountFromIdentity({ platform: 'discord', platformUserId: 'discord-five', displayName: 'sender' })

    await expect(
      walletAccounts.bindVerifiedWallet({
        actor: { platform: 'discord', platformUserId: 'discord-five' },
        solanaAddress: '00000000000000000000000000000000',
        proof: 'test-wallet-proof'
      })
    ).rejects.toMatchObject({ code: 'INVALID_SOLANA_ADDRESS' })
    expect(verificationCalls).toBe(0)
  })

  it('rejects an amount larger than the supported unsigned lamport range before resolving a recipient', async () => {
    const intents = createInternalTransferIntentService({
      repository: new MemorySocialRepository(),
      clock: () => new Date('2026-08-27T12:00:00.000Z')
    })

    await expect(
      intents.create({
        actor: { platform: 'discord', platformUserId: 'discord-six' },
        recipient: { platform: 'telegram', platformUserId: 'telegram-seven' },
        amountLamports: '18446744073709551616',
        idempotencyKey: 'internal-transfer-intent-0004'
      })
    ).rejects.toMatchObject({ code: 'INVALID_TRANSFER_AMOUNT' })
  })
})
