import { randomUUID } from 'node:crypto'

import { DomainError } from '../domain/errors.js'
import type { Account, LinkedIdentity, PairingCode, PairingRequest, PlatformActor } from '../domain/models.js'
import {
  confirmPairingSchema,
  consumePairingSchema,
  createIdentitySchema,
  hashPairingCode,
  issuePairingSchema,
  normalizePairingCode,
  parseOrThrow,
  platformActorSchema
} from '../domain/pairing.js'
import type { SocialRepository } from '../ports/social-repository.js'

const pairingLifetimeMs = 10 * 60 * 1000

export interface AccountServiceDependencies {
  repository: SocialRepository
  clock?: () => Date
  idGenerator?: () => string
  codeGenerator?: () => string
}

export interface CreateAccountFromIdentityInput extends PlatformActor {
  displayName: string
}

export interface RequestPairingInput {
  actor: PlatformActor
  code: string
}

export interface IssuePairingCodeInput {
  actor: PlatformActor
  targetPlatform: PlatformActor['platform']
}

export interface ConfirmPairingRequestInput {
  actor: PlatformActor
  requestId: string
}

export interface AccountService {
  createAccountFromIdentity(input: CreateAccountFromIdentityInput): Promise<Account>
  issuePairingCode(input: IssuePairingCodeInput): Promise<PairingCode>
  requestPairing(input: RequestPairingInput): Promise<PairingRequest>
  confirmPairingRequest(input: ConfirmPairingRequestInput): Promise<Account>
  getAccountForIdentity(actor: PlatformActor): Promise<Account | null>
}

function defaultPairingCode(): string {
  return randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()
}

export function createAccountService(dependencies: AccountServiceDependencies): AccountService {
  const clock = dependencies.clock ?? (() => new Date())
  const idGenerator = dependencies.idGenerator ?? randomUUID
  const codeGenerator = dependencies.codeGenerator ?? defaultPairingCode

  async function getAccountForIdentity(input: PlatformActor): Promise<Account | null> {
    const actor = parseOrThrow(platformActorSchema, input)
    const identity = await dependencies.repository.findIdentity(actor.platform, actor.platformUserId)
    if (identity === null) return null
    return dependencies.repository.getAccount(identity.accountId)
  }

  async function createAccountFromIdentity(input: CreateAccountFromIdentityInput): Promise<Account> {
    const identityInput = parseOrThrow(createIdentitySchema, input)
    const existing = await dependencies.repository.findIdentity(identityInput.platform, identityInput.platformUserId)
    if (existing !== null) {
      throw new DomainError('IDENTITY_ALREADY_LINKED', 'This chat identity is already linked to an account.')
    }

    const now = clock()
    const account: Account = { id: idGenerator(), createdAt: now, identities: [] }
    const identity: LinkedIdentity = {
      id: idGenerator(),
      accountId: account.id,
      platform: identityInput.platform,
      platformUserId: identityInput.platformUserId,
      displayName: identityInput.displayName,
      acceptsInternalTransfers: false,
      createdAt: now
    }

    await dependencies.repository.createAccount(account)
    await dependencies.repository.addIdentity(identity)
    const result = await dependencies.repository.getAccount(account.id)
    if (result === null) throw new Error('Account creation invariant failed.')
    return result
  }

  async function issuePairingCode(input: IssuePairingCodeInput): Promise<PairingCode> {
    const parsed = parseOrThrow(issuePairingSchema, input)
    const actor = parsed.actor
    const sourceIdentity = await dependencies.repository.findIdentity(actor.platform, actor.platformUserId)
    if (sourceIdentity === null) {
      throw new DomainError('PAIRING_SOURCE_NOT_FOUND', 'Create a shared account before linking another platform.')
    }
    if (parsed.targetPlatform === sourceIdentity.platform) {
      throw new DomainError('PAIRING_TARGET_PLATFORM_MUST_DIFFER', 'Choose the other supported chat platform for pairing.')
    }

    const now = clock()
    const code = normalizePairingCode(codeGenerator())
    const record = {
      id: idGenerator(),
      codeHash: hashPairingCode(code),
      accountId: sourceIdentity.accountId,
      issuedByIdentityId: sourceIdentity.id,
      targetPlatform: parsed.targetPlatform,
      expiresAt: new Date(now.getTime() + pairingLifetimeMs),
      consumedAt: null
    }
    await dependencies.repository.createPairingCode(record)
    return { code, expiresAt: record.expiresAt }
  }

  async function requestPairing(input: RequestPairingInput): Promise<PairingRequest> {
    const target = parseOrThrow(consumePairingSchema, { ...input.actor, code: input.code })
    const targetIdentity = await dependencies.repository.findIdentity(target.platform, target.platformUserId)
    if (targetIdentity !== null) {
      throw new DomainError('TARGET_IDENTITY_ALREADY_LINKED', 'This chat identity is already linked to an account.')
    }

    const record = await dependencies.repository.findPairingCode(hashPairingCode(target.code))
    if (record === null) {
      throw new DomainError('PAIRING_CODE_INVALID', 'That pairing code is not valid.')
    }
    if (record.targetPlatform !== target.platform) {
      throw new DomainError('PAIRING_CODE_TARGET_PLATFORM_MISMATCH', 'This pairing code was issued for a different chat platform.')
    }
    if (record.consumedAt !== null) {
      throw new DomainError('PAIRING_CODE_REPLAYED', 'That pairing code was already used.')
    }

    const now = clock()
    if (record.expiresAt.getTime() <= now.getTime()) {
      throw new DomainError('PAIRING_CODE_EXPIRED', 'That pairing code has expired.')
    }

    const consumed = await dependencies.repository.consumePairingCode(record.id, now)
    if (!consumed) {
      throw new DomainError('PAIRING_CODE_REPLAYED', 'That pairing code was already used.')
    }

    const request = {
      id: idGenerator(),
      accountId: record.accountId,
      sourceIdentityId: record.issuedByIdentityId,
      target: { platform: target.platform, platformUserId: target.platformUserId },
      expiresAt: record.expiresAt,
      status: 'AWAITING_SOURCE_CONFIRMATION' as const,
      createdAt: now,
      confirmedAt: null
    }
    await dependencies.repository.createPairingRequest(request)
    return request
  }

  async function confirmPairingRequest(input: ConfirmPairingRequestInput): Promise<Account> {
    const parsed = parseOrThrow(confirmPairingSchema, input)
    const request = await dependencies.repository.getPairingRequest(parsed.requestId)
    if (request === null || request.status !== 'AWAITING_SOURCE_CONFIRMATION') {
      throw new DomainError('PAIRING_REQUEST_INVALID', 'That pairing request is not available.')
    }

    const now = clock()
    if (request.expiresAt.getTime() <= now.getTime()) {
      throw new DomainError('PAIRING_REQUEST_EXPIRED', 'That pairing request has expired.')
    }

    const sourceIdentity = await dependencies.repository.findIdentity(parsed.actor.platform, parsed.actor.platformUserId)
    if (sourceIdentity?.id !== request.sourceIdentityId) {
      throw new DomainError('PAIRING_REQUEST_NOT_AUTHORIZED', 'Only the identity that started pairing can confirm it.')
    }

    const targetIdentity = await dependencies.repository.findIdentity(request.target.platform, request.target.platformUserId)
    if (targetIdentity !== null) {
      throw new DomainError('TARGET_IDENTITY_ALREADY_LINKED', 'This chat identity is already linked to an account.')
    }

    const account = await dependencies.repository.getAccount(request.accountId)
    if (account === null) throw new Error('Pairing request references an unknown account.')

    const confirmed = await dependencies.repository.confirmPairingRequest(request.id, now)
    if (!confirmed) {
      throw new DomainError('PAIRING_REQUEST_INVALID', 'That pairing request is not available.')
    }

    await dependencies.repository.addIdentity({
      id: idGenerator(),
      accountId: request.accountId,
      platform: request.target.platform,
      platformUserId: request.target.platformUserId,
      displayName: `${request.target.platform} user`,
      acceptsInternalTransfers: false,
      createdAt: now
    })

    const updated = await dependencies.repository.getAccount(account.id)
    if (updated === null) throw new Error('Pairing completion invariant failed.')
    return updated
  }

  return { createAccountFromIdentity, issuePairingCode, requestPairing, confirmPairingRequest, getAccountForIdentity }
}
