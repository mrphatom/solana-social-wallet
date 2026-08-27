import type { Account, LinkedIdentity, PairingCodeRecord, PairingRequest, Platform } from '../domain/models.js'
import type { SocialRepository } from '../ports/social-repository.js'

function cloneIdentity(identity: LinkedIdentity): LinkedIdentity {
  return { ...identity, createdAt: new Date(identity.createdAt) }
}

function cloneAccount(account: Account): Account {
  return {
    ...account,
    createdAt: new Date(account.createdAt),
    identities: account.identities.map(cloneIdentity)
  }
}

function clonePairingCode(record: PairingCodeRecord): PairingCodeRecord {
  return {
    ...record,
    expiresAt: new Date(record.expiresAt),
    consumedAt: record.consumedAt === null ? null : new Date(record.consumedAt)
  }
}

function clonePairingRequest(request: PairingRequest): PairingRequest {
  return {
    ...request,
    target: { ...request.target },
    expiresAt: new Date(request.expiresAt),
    createdAt: new Date(request.createdAt),
    confirmedAt: request.confirmedAt === null ? null : new Date(request.confirmedAt)
  }
}

function identityKey(platform: Platform, platformUserId: string): string {
  return `${platform}:${platformUserId}`
}

export class MemorySocialRepository implements SocialRepository {
  private readonly accounts = new Map<string, Account>()
  private readonly identities = new Map<string, LinkedIdentity>()
  private readonly pairingCodesByHash = new Map<string, PairingCodeRecord>()
  private readonly pairingCodeHashById = new Map<string, string>()
  private readonly pairingRequests = new Map<string, PairingRequest>()

  public async createAccount(account: Account): Promise<void> {
    this.accounts.set(account.id, cloneAccount(account))
  }

  public async getAccount(accountId: string): Promise<Account | null> {
    const account = this.accounts.get(accountId)
    return account === undefined ? null : cloneAccount(account)
  }

  public async findIdentity(platform: Platform, platformUserId: string): Promise<LinkedIdentity | null> {
    const identity = this.identities.get(identityKey(platform, platformUserId))
    return identity === undefined ? null : cloneIdentity(identity)
  }

  public async addIdentity(identity: LinkedIdentity): Promise<void> {
    const key = identityKey(identity.platform, identity.platformUserId)
    if (this.identities.has(key)) {
      throw new Error('A platform identity can belong to only one account.')
    }
    this.identities.set(key, cloneIdentity(identity))
    const account = this.accounts.get(identity.accountId)
    if (account === undefined) {
      throw new Error('Cannot add an identity to an unknown account.')
    }
    account.identities.push(cloneIdentity(identity))
  }

  public async createPairingCode(record: PairingCodeRecord): Promise<void> {
    this.pairingCodesByHash.set(record.codeHash, clonePairingCode(record))
    this.pairingCodeHashById.set(record.id, record.codeHash)
  }

  public async findPairingCode(codeHash: string): Promise<PairingCodeRecord | null> {
    const record = this.pairingCodesByHash.get(codeHash)
    return record === undefined ? null : clonePairingCode(record)
  }

  public async consumePairingCode(pairingCodeId: string, consumedAt: Date): Promise<boolean> {
    const hash = this.pairingCodeHashById.get(pairingCodeId)
    if (hash === undefined) return false
    const record = this.pairingCodesByHash.get(hash)
    if (record === undefined || record.consumedAt !== null) return false
    record.consumedAt = new Date(consumedAt)
    return true
  }

  public async createPairingRequest(request: PairingRequest): Promise<void> {
    this.pairingRequests.set(request.id, clonePairingRequest(request))
  }

  public async getPairingRequest(requestId: string): Promise<PairingRequest | null> {
    const request = this.pairingRequests.get(requestId)
    return request === undefined ? null : clonePairingRequest(request)
  }

  public async confirmPairingRequest(requestId: string, confirmedAt: Date): Promise<boolean> {
    const request = this.pairingRequests.get(requestId)
    if (request === undefined || request.status !== 'AWAITING_SOURCE_CONFIRMATION') return false
    request.status = 'CONFIRMED'
    request.confirmedAt = new Date(confirmedAt)
    return true
  }
}
