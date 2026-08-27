import { z } from 'zod'

import { isSolanaPublicKey } from '../domain/base58.js'
import { DomainError } from '../domain/errors.js'
import type { PlatformActor, SolanaWalletAccount } from '../domain/models.js'
import { parseOrThrow, platformActorSchema } from '../domain/pairing.js'
import type { SocialRepository } from '../ports/social-repository.js'

const bindWalletSchema = z.object({
  actor: platformActorSchema,
  solanaAddress: z.string().trim().min(32).max(44),
  proof: z.string().trim().min(1).max(4096)
})

const optInSchema = z.object({
  actor: platformActorSchema,
  acceptsInternalTransfers: z.boolean()
})

export interface WalletOwnershipVerifier {
  verify(input: { accountId: string; solanaAddress: string; proof: string }): Promise<boolean>
}

export interface WalletAccountServiceDependencies {
  repository: SocialRepository
  ownershipVerifier: WalletOwnershipVerifier
  clock?: () => Date
}

export function createWalletAccountService(dependencies: WalletAccountServiceDependencies) {
  const clock = dependencies.clock ?? (() => new Date())

  async function bindVerifiedWallet(input: unknown): Promise<SolanaWalletAccount> {
    const parsed = parseOrThrow(bindWalletSchema, input)
    if (!isSolanaPublicKey(parsed.solanaAddress)) {
      throw new DomainError('INVALID_SOLANA_ADDRESS', 'The Solana wallet address is not valid.')
    }
    const actor = parsed.actor
    const identity = await dependencies.repository.findIdentity(actor.platform, actor.platformUserId)
    if (identity === null) throw new DomainError('PAIRING_SOURCE_NOT_FOUND', 'Create a shared account before linking a wallet.')

    const existing = await dependencies.repository.findSolanaWalletByAddress(parsed.solanaAddress)
    if (existing !== null && existing.accountId !== identity.accountId) {
      throw new DomainError('WALLET_ADDRESS_ALREADY_BOUND', 'That Solana wallet is linked to another shared account.')
    }

    const verified = await dependencies.ownershipVerifier.verify({
      accountId: identity.accountId,
      solanaAddress: parsed.solanaAddress,
      proof: parsed.proof
    })
    if (!verified) throw new DomainError('WALLET_PROOF_INVALID', 'Wallet ownership could not be verified.')

    const wallet: SolanaWalletAccount = {
      accountId: identity.accountId,
      chain: 'solana',
      address: parsed.solanaAddress,
      verifiedAt: clock()
    }
    await dependencies.repository.bindSolanaWallet(wallet)
    return wallet
  }

  async function setInternalTransferOptIn(input: unknown): Promise<void> {
    const parsed = parseOrThrow(optInSchema, input)
    const identity = await dependencies.repository.findIdentity(parsed.actor.platform, parsed.actor.platformUserId)
    if (identity === null) throw new DomainError('PAIRING_SOURCE_NOT_FOUND', 'Create a shared account before changing transfer settings.')
    await dependencies.repository.updateIdentity({ ...identity, acceptsInternalTransfers: parsed.acceptsInternalTransfers })
  }

  async function getWalletForActor(actor: PlatformActor): Promise<SolanaWalletAccount | null> {
    const parsed = parseOrThrow(platformActorSchema, actor)
    const identity = await dependencies.repository.findIdentity(parsed.platform, parsed.platformUserId)
    if (identity === null) return null
    return dependencies.repository.getSolanaWallet(identity.accountId)
  }

  return { bindVerifiedWallet, setInternalTransferOptIn, getWalletForActor }
}
