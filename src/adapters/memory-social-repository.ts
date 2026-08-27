import type {
  Account,
  InternalTransferIntent,
  LinkedIdentity,
  PairingCodeRecord,
  PairingRequest,
  Platform,
  SolanaWalletAccount
} from '../domain/models.js'
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

function cloneWallet(wallet: SolanaWalletAccount): SolanaWalletAccount {
  return { ...wallet, verifiedAt: new Date(wallet.verifiedAt) }
}

function cloneIntent(intent: InternalTransferIntent): InternalTransferIntent {
  return { ...intent, recipient: { ...intent.recipient }, createdAt: new Date(intent.createdAt) }
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
  private readonly solanaWalletsByAccount = new Map<string, SolanaWalletAccount>()
  private readonly solanaWalletsByAddress = new Map<string, SolanaWalletAccount>()
  private readonly intentsByIdempotency = new Map<string, InternalTransferIntent>()

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

  public async updateIdentity(identity: LinkedIdentity): Promise<void> {
    const key = identityKey(identity.platform, identity.platformUserId)
    if (!this.identities.has(key)) throw new Error('Cannot update an unknown platform identity.')
    this.identities.set(key, cloneIdentity(identity))
    const account = this.accounts.get(identity.accountId)
    if (account === undefined) throw new Error('Cannot update an identity for an unknown account.')
    const index = account.identities.findIndex((candidate) => candidate.id === identity.id)
    if (index === -1) throw new Error('Cannot update an unowned platform identity.')
    account.identities[index] = cloneIdentity(identity)
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

  public async finalizePairingRequest(input: {
    requestId: string
    identity: LinkedIdentity
    confirmedAt: Date
  }): Promise<'SUCCESS' | 'PAIRING_UNAVAILABLE' | 'TARGET_IDENTITY_ALREADY_LINKED'> {
    const request = this.pairingRequests.get(input.requestId)
    if (request === undefined || request.status !== 'AWAITING_SOURCE_CONFIRMATION') return 'PAIRING_UNAVAILABLE'
    const targetKey = identityKey(input.identity.platform, input.identity.platformUserId)
    if (this.identities.has(targetKey)) return 'TARGET_IDENTITY_ALREADY_LINKED'
    const account = this.accounts.get(input.identity.accountId)
    if (account === undefined) return 'PAIRING_UNAVAILABLE'

    this.identities.set(targetKey, cloneIdentity(input.identity))
    account.identities.push(cloneIdentity(input.identity))
    request.status = 'CONFIRMED'
    request.confirmedAt = new Date(input.confirmedAt)
    return 'SUCCESS'
  }

  public async getSolanaWallet(accountId: string): Promise<SolanaWalletAccount | null> {
    const wallet = this.solanaWalletsByAccount.get(accountId)
    return wallet === undefined ? null : cloneWallet(wallet)
  }

  public async findSolanaWalletByAddress(address: string): Promise<SolanaWalletAccount | null> {
    const wallet = this.solanaWalletsByAddress.get(address)
    return wallet === undefined ? null : cloneWallet(wallet)
  }

  public async bindSolanaWallet(wallet: SolanaWalletAccount): Promise<void> {
    const existingByAddress = this.solanaWalletsByAddress.get(wallet.address)
    if (existingByAddress !== undefined && existingByAddress.accountId !== wallet.accountId) {
      throw new Error('A Solana wallet address can belong to only one account.')
    }
    const priorForAccount = this.solanaWalletsByAccount.get(wallet.accountId)
    if (priorForAccount !== undefined && priorForAccount.address !== wallet.address) {
      this.solanaWalletsByAddress.delete(priorForAccount.address)
    }
    this.solanaWalletsByAccount.set(wallet.accountId, cloneWallet(wallet))
    this.solanaWalletsByAddress.set(wallet.address, cloneWallet(wallet))
  }

  public async getInternalTransferIntent(senderAccountId: string, idempotencyKey: string): Promise<InternalTransferIntent | null> {
    const intent = this.intentsByIdempotency.get(`${senderAccountId}:${idempotencyKey}`)
    return intent === undefined ? null : cloneIntent(intent)
  }

  public async createInternalTransferIntent(intent: InternalTransferIntent): Promise<void> {
    const key = `${intent.senderAccountId}:${intent.idempotencyKey}`
    if (this.intentsByIdempotency.has(key)) throw new Error('An intent already exists for this idempotency key.')
    this.intentsByIdempotency.set(key, cloneIntent(intent))
  }
}
