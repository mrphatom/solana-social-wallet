import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import { DomainError } from '../domain/errors.js'
import type { InternalTransferIntent, PlatformActor, TransferIntentRecipient } from '../domain/models.js'
import { parseOrThrow, platformActorSchema } from '../domain/pairing.js'
import type { SocialRepository } from '../ports/social-repository.js'

const maxLamports = 18_446_744_073_709_551_615n

const createInternalTransferIntentSchema = z.object({
  actor: platformActorSchema,
  recipient: platformActorSchema,
  amountLamports: z.string().regex(/^[1-9][0-9]{0,19}$/),
  idempotencyKey: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{7,127}$/)
})

export interface CreateInternalTransferIntentInput {
  actor: PlatformActor
  recipient: PlatformActor
  amountLamports: string
  idempotencyKey: string
}

export interface InternalTransferIntentServiceDependencies {
  repository: SocialRepository
  clock?: () => Date
  idGenerator?: () => string
}

export function createInternalTransferIntentService(dependencies: InternalTransferIntentServiceDependencies) {
  const clock = dependencies.clock ?? (() => new Date())
  const idGenerator = dependencies.idGenerator ?? randomUUID

  async function create(input: CreateInternalTransferIntentInput): Promise<InternalTransferIntent> {
    const parsed = parseOrThrow(createInternalTransferIntentSchema, input)
    const amountLamports = BigInt(parsed.amountLamports)
    if (amountLamports <= 0n || amountLamports > maxLamports) {
      throw new DomainError('INVALID_TRANSFER_AMOUNT', 'The transfer amount is outside the supported lamport range.')
    }

    const senderIdentity = await dependencies.repository.findIdentity(parsed.actor.platform, parsed.actor.platformUserId)
    if (senderIdentity === null) throw new DomainError('PAIRING_SOURCE_NOT_FOUND', 'Create a shared account before requesting a transfer.')
    const existing = await dependencies.repository.getInternalTransferIntent(senderIdentity.accountId, parsed.idempotencyKey)
    if (existing !== null) return existing

    const recipientIdentity = await dependencies.repository.findIdentity(parsed.recipient.platform, parsed.recipient.platformUserId)
    if (recipientIdentity === null) throw new DomainError('RECIPIENT_NOT_FOUND', 'This recipient has not linked an eligible chat account.')
    if (recipientIdentity.accountId === senderIdentity.accountId) {
      throw new DomainError('SELF_TRANSFER_NOT_ALLOWED', 'Choose a different verified recipient.')
    }
    if (!recipientIdentity.acceptsInternalTransfers) {
      throw new DomainError('INTERNAL_TRANSFER_OPT_IN_REQUIRED', 'This recipient has not enabled internal transfers.')
    }

    const senderWallet = await dependencies.repository.getSolanaWallet(senderIdentity.accountId)
    if (senderWallet === null) {
      throw new DomainError('SENDER_WALLET_NOT_FOUND', 'Link and verify a Solana wallet before creating a transfer request.')
    }
    const recipientWallet = await dependencies.repository.getSolanaWallet(recipientIdentity.accountId)
    if (recipientWallet === null) {
      throw new DomainError('RECIPIENT_NOT_FOUND', 'This recipient has not linked a Solana wallet.')
    }

    const recipient: TransferIntentRecipient = {
      accountId: recipientIdentity.accountId,
      platform: recipientIdentity.platform,
      platformUserId: recipientIdentity.platformUserId,
      solanaAddress: recipientWallet.address
    }
    const intent: InternalTransferIntent = {
      id: idGenerator(),
      senderAccountId: senderIdentity.accountId,
      recipient,
      amountLamports,
      network: 'solana:devnet',
      idempotencyKey: parsed.idempotencyKey,
      state: 'AWAITING_WALLET_APPROVAL',
      createdAt: clock()
    }
    await dependencies.repository.createInternalTransferIntent(intent)
    return intent
  }

  return { create }
}
