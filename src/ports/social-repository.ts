import type {
  Account,
  InternalTransferIntent,
  LinkedIdentity,
  PairingCodeRecord,
  PairingRequest,
  Platform,
  SolanaWalletAccount
} from '../domain/models.js'

export interface SocialRepository {
  createAccount(account: Account): Promise<void>
  getAccount(accountId: string): Promise<Account | null>
  findIdentity(platform: Platform, platformUserId: string): Promise<LinkedIdentity | null>
  addIdentity(identity: LinkedIdentity): Promise<void>
  updateIdentity(identity: LinkedIdentity): Promise<void>
  createPairingCode(record: PairingCodeRecord): Promise<void>
  findPairingCode(codeHash: string): Promise<PairingCodeRecord | null>
  consumePairingCode(pairingCodeId: string, consumedAt: Date): Promise<boolean>
  createPairingRequest(request: PairingRequest): Promise<void>
  getPairingRequest(requestId: string): Promise<PairingRequest | null>
  finalizePairingRequest(input: {
    requestId: string
    identity: LinkedIdentity
    confirmedAt: Date
  }): Promise<'SUCCESS' | 'PAIRING_UNAVAILABLE' | 'TARGET_IDENTITY_ALREADY_LINKED'>
  getSolanaWallet(accountId: string): Promise<SolanaWalletAccount | null>
  findSolanaWalletByAddress(address: string): Promise<SolanaWalletAccount | null>
  bindSolanaWallet(wallet: SolanaWalletAccount): Promise<void>
  getInternalTransferIntent(senderAccountId: string, idempotencyKey: string): Promise<InternalTransferIntent | null>
  createInternalTransferIntent(intent: InternalTransferIntent): Promise<void>
}
