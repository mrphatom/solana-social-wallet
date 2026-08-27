import type { Platform } from '../domain/models.js'
import type { DirectoryResolutionDecision, DirectoryResolutionEvidence } from '../domain/social-directory.js'

/**
 * Future integration contract only. A concrete adapter must obtain `platformUserId` from a verified
 * platform selection/reply context; it must never fill this from a raw username or display name.
 */
export interface VerifiedSocialDiscoveryContext {
  platform: Platform
  platformUserId: string
  scopeKind: 'DIRECT' | 'DISCORD_GUILD' | 'TELEGRAM_CHAT' | 'CROSS_PLATFORM_CARD'
  scopeId: string
  subjectCommitment: string
  tipCardCapability: string
  tipCardId: string
  requestedAt: Date
}

export interface DirectoryResolverPolicy {
  attesterThreshold: number
  rootThreshold: number
  replicaQuorum: number
  maximumRootAgeMilliseconds: number
}

export interface DirectoryEvidenceCollector {
  collect(
    context: VerifiedSocialDiscoveryContext,
    policy: DirectoryResolverPolicy
  ): Promise<readonly DirectoryResolutionEvidence[]>
}

export type SocialTipDiscoveryResult =
  | {
      kind: 'VERIFIED_SOCIAL_TIP_RECIPIENT'
      walletAddress: string
      bundleHash: string
      decision: Extract<DirectoryResolutionDecision, { kind: 'VERIFIED_RECIPIENT' }>
    }
  | { kind: 'SOCIAL_TIP_RECIPIENT_UNAVAILABLE'; decision: Exclude<DirectoryResolutionDecision, { kind: 'VERIFIED_RECIPIENT' }> }

/**
 * Future orchestration contract. It has no default implementation, cannot accept a username, and cannot
 * create a transfer, wallet session, signature, network request, or registry write.
 */
export interface SocialTipDirectoryResolver {
  resolve(context: VerifiedSocialDiscoveryContext): Promise<SocialTipDiscoveryResult>
}
