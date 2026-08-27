export const supportedPlatforms = ['discord', 'telegram'] as const

export type Platform = (typeof supportedPlatforms)[number]

export interface PlatformActor {
  platform: Platform
  platformUserId: string
}

export interface LinkedIdentity extends PlatformActor {
  id: string
  accountId: string
  displayName: string
  acceptsInternalTransfers: boolean
  createdAt: Date
}

export interface Account {
  id: string
  createdAt: Date
  identities: LinkedIdentity[]
}

export interface PairingCodeRecord {
  id: string
  codeHash: string
  accountId: string
  issuedByIdentityId: string
  targetPlatform: Platform
  expiresAt: Date
  consumedAt: Date | null
}

export interface PairingCode {
  code: string
  expiresAt: Date
}

export type PairingRequestStatus = 'AWAITING_SOURCE_CONFIRMATION' | 'CONFIRMED'

export interface PairingRequest {
  id: string
  accountId: string
  sourceIdentityId: string
  target: PlatformActor
  expiresAt: Date
  status: PairingRequestStatus
  createdAt: Date
  confirmedAt: Date | null
}
