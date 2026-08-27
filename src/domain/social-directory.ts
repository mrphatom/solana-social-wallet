export type SocialDirectoryStatus = 'ACTIVE' | 'ROTATED' | 'REVOKED' | 'SUSPENDED' | 'EXPIRED'

export interface DirectoryAttesterEvidence {
  failureDomain: string
  signatureValid: boolean
}

export interface DirectoryRootEvidence {
  certificateHash: string
  isFresh: boolean
  hasValidInclusionProof: boolean
  hasValidConsistencyProof: boolean
  signerFailureDomains: readonly string[]
  signaturesValid: boolean
}

export interface DirectoryResolutionEvidence {
  replicaFailureDomain: string
  bundleHash: string
  subjectCommitment: string
  walletAddress: string
  bindingSignatureValid: boolean
  bindingFresh: boolean
  recipientConsent: 'SOCIAL_TIP_DISCOVERY_ONLY'
  status: SocialDirectoryStatus
  statusRecordHash: string
  attesters: readonly DirectoryAttesterEvidence[]
  root: DirectoryRootEvidence
}

export interface DirectoryResolutionInput {
  request: {
    platformSubjectVerified: boolean
    tipCardValid: boolean
    subjectCommitment: string
  }
  policy: {
    attesterThreshold: number
    rootThreshold: number
    replicaQuorum: number
  }
  evidence: readonly DirectoryResolutionEvidence[]
}

export type DirectoryResolutionDecision =
  | {
      kind: 'VERIFIED_RECIPIENT'
      walletAddress: string
      bundleHash: string
      assurance: 'THRESHOLD_AND_REPLICA_QUORUM'
    }
  | {
      kind: 'DIRECTORY_UNAVAILABLE'
      reason: 'DISCOVERY_NOT_AUTHORIZED' | 'DIRECTORY_POLICY_INVALID' | 'REPLICA_QUORUM_NOT_MET'
    }
  | { kind: 'DIRECTORY_CONFLICT'; reason: 'MULTIPLE_QUORUM_BUNDLES' }

/**
 * Pure policy only. Upstream adapters must independently validate canonical record bytes, signatures,
 * attester/root membership, and Merkle proofs before mapping them to this evidence shape.
 */
export function evaluateDirectoryResolution(input: DirectoryResolutionInput): DirectoryResolutionDecision {
  if (!hasMultiPartyPolicy(input.policy)) {
    return { kind: 'DIRECTORY_UNAVAILABLE', reason: 'DIRECTORY_POLICY_INVALID' }
  }
  if (!input.request.platformSubjectVerified || !input.request.tipCardValid) {
    return { kind: 'DIRECTORY_UNAVAILABLE', reason: 'DISCOVERY_NOT_AUTHORIZED' }
  }

  const candidates = input.evidence.filter((item) => isAcceptedEvidence(item, input))
  const byBundle: DirectoryResolutionEvidence[][] = []
  for (const candidate of candidates) {
    const entries = byBundle.find((group) => isSameBundle(group[0], candidate))
    if (entries === undefined) {
      byBundle.push([candidate])
    } else {
      entries.push(candidate)
    }
  }

  const quorums = byBundle.filter(
    (entries) => uniqueCount(entries.map((item) => item.replicaFailureDomain)) >= input.policy.replicaQuorum
  )

  if (quorums.length > 1) {
    return { kind: 'DIRECTORY_CONFLICT', reason: 'MULTIPLE_QUORUM_BUNDLES' }
  }
  const [accepted] = quorums
  if (accepted === undefined) {
    return { kind: 'DIRECTORY_UNAVAILABLE', reason: 'REPLICA_QUORUM_NOT_MET' }
  }

  const representative = accepted[0]
  if (representative === undefined) {
    return { kind: 'DIRECTORY_UNAVAILABLE', reason: 'REPLICA_QUORUM_NOT_MET' }
  }
  return {
    kind: 'VERIFIED_RECIPIENT',
    walletAddress: representative.walletAddress,
    bundleHash: representative.bundleHash,
    assurance: 'THRESHOLD_AND_REPLICA_QUORUM'
  }
}

function isAcceptedEvidence(item: DirectoryResolutionEvidence, input: DirectoryResolutionInput): boolean {
  return (
    item.subjectCommitment === input.request.subjectCommitment &&
    item.bindingSignatureValid &&
    item.bindingFresh &&
    item.recipientConsent === 'SOCIAL_TIP_DISCOVERY_ONLY' &&
    item.status === 'ACTIVE' &&
    item.root.isFresh &&
    item.root.hasValidInclusionProof &&
    item.root.hasValidConsistencyProof &&
    item.root.signaturesValid &&
    uniqueCount(item.attesters.filter((attester) => attester.signatureValid).map((attester) => attester.failureDomain)) >=
      input.policy.attesterThreshold &&
    uniqueCount(item.root.signerFailureDomains) >= input.policy.rootThreshold
  )
}

function isSameBundle(
  candidate: DirectoryResolutionEvidence | undefined,
  reference: DirectoryResolutionEvidence
): boolean {
  return (
    candidate !== undefined &&
    candidate.bundleHash === reference.bundleHash &&
    candidate.walletAddress === reference.walletAddress &&
    candidate.statusRecordHash === reference.statusRecordHash &&
    candidate.root.certificateHash === reference.root.certificateHash
  )
}

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size
}

function hasMultiPartyPolicy(policy: DirectoryResolutionInput['policy']): boolean {
  return [policy.attesterThreshold, policy.rootThreshold, policy.replicaQuorum].every(
    (threshold) => Number.isInteger(threshold) && threshold >= 2
  )
}
