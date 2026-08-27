import type { Account, LinkedIdentity, PairingCodeRecord, PairingRequest, Platform } from '../domain/models.js'

export interface SocialRepository {
  createAccount(account: Account): Promise<void>
  getAccount(accountId: string): Promise<Account | null>
  findIdentity(platform: Platform, platformUserId: string): Promise<LinkedIdentity | null>
  addIdentity(identity: LinkedIdentity): Promise<void>
  createPairingCode(record: PairingCodeRecord): Promise<void>
  findPairingCode(codeHash: string): Promise<PairingCodeRecord | null>
  consumePairingCode(pairingCodeId: string, consumedAt: Date): Promise<boolean>
  createPairingRequest(request: PairingRequest): Promise<void>
  getPairingRequest(requestId: string): Promise<PairingRequest | null>
  confirmPairingRequest(requestId: string, confirmedAt: Date): Promise<boolean>
}
