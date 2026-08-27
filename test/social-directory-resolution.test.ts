import { describe, expect, it } from 'vitest'

import { evaluateDirectoryResolution } from '../src/domain/social-directory.js'

const commonEvidence = {
  bundleHash: 'sha256:bundle-a',
  subjectCommitment: 'sha256:subject-a',
  walletAddress: '11111111111111111111111111111111',
  bindingSignatureValid: true,
  bindingFresh: true,
  recipientConsent: 'SOCIAL_TIP_DISCOVERY_ONLY' as const,
  status: 'ACTIVE' as const,
  statusRecordHash: 'sha256:status-a',
  attesters: [
    { failureDomain: 'attester-a', signatureValid: true },
    { failureDomain: 'attester-b', signatureValid: true }
  ],
  root: {
    certificateHash: 'sha256:root-a',
    isFresh: true,
    hasValidInclusionProof: true,
    hasValidConsistencyProof: true,
    signerFailureDomains: ['root-a', 'root-b', 'root-c'],
    signaturesValid: true
  }
}

describe('social directory resolution policy', () => {
  it('returns a recipient address only after two independent verified replicas agree on the complete current bundle', () => {
    const resolution = evaluateDirectoryResolution({
      request: {
        platformSubjectVerified: true,
        tipCardValid: true,
        subjectCommitment: 'sha256:subject-a'
      },
      policy: { attesterThreshold: 2, rootThreshold: 3, replicaQuorum: 2 },
      evidence: [
        { ...commonEvidence, replicaFailureDomain: 'replica-a' },
        { ...commonEvidence, replicaFailureDomain: 'replica-b' }
      ]
    })

    expect(resolution).toEqual({
      kind: 'VERIFIED_RECIPIENT',
      walletAddress: '11111111111111111111111111111111',
      bundleHash: 'sha256:bundle-a',
      assurance: 'THRESHOLD_AND_REPLICA_QUORUM'
    })
  })

  it('refuses a single replica and stops on independently verified conflicting bundles', () => {
    expect(
      evaluateDirectoryResolution({
        request: { platformSubjectVerified: true, tipCardValid: true, subjectCommitment: 'sha256:subject-a' },
        policy: { attesterThreshold: 2, rootThreshold: 3, replicaQuorum: 2 },
        evidence: [{ ...commonEvidence, replicaFailureDomain: 'replica-a' }]
      })
    ).toEqual({ kind: 'DIRECTORY_UNAVAILABLE', reason: 'REPLICA_QUORUM_NOT_MET' })

    expect(
      evaluateDirectoryResolution({
        request: { platformSubjectVerified: true, tipCardValid: true, subjectCommitment: 'sha256:subject-a' },
        policy: { attesterThreshold: 2, rootThreshold: 3, replicaQuorum: 2 },
        evidence: [
          { ...commonEvidence, replicaFailureDomain: 'replica-a' },
          { ...commonEvidence, replicaFailureDomain: 'replica-b' },
          {
            ...commonEvidence,
            bundleHash: 'sha256:bundle-b',
            walletAddress: 'SysvarC1ock11111111111111111111111111111111',
            statusRecordHash: 'sha256:status-b',
            replicaFailureDomain: 'replica-c'
          },
          {
            ...commonEvidence,
            bundleHash: 'sha256:bundle-b',
            walletAddress: 'SysvarC1ock11111111111111111111111111111111',
            statusRecordHash: 'sha256:status-b',
            replicaFailureDomain: 'replica-d'
          }
        ]
      })
    ).toEqual({ kind: 'DIRECTORY_CONFLICT', reason: 'MULTIPLE_QUORUM_BUNDLES' })
  })

  it('fails closed when the directory policy would permit a single point of authority or zero evidence threshold', () => {
    expect(
      evaluateDirectoryResolution({
        request: { platformSubjectVerified: true, tipCardValid: true, subjectCommitment: 'sha256:subject-a' },
        policy: { attesterThreshold: 0, rootThreshold: 1, replicaQuorum: 1 },
        evidence: [{ ...commonEvidence, replicaFailureDomain: 'replica-a' }]
      })
    ).toEqual({ kind: 'DIRECTORY_UNAVAILABLE', reason: 'DIRECTORY_POLICY_INVALID' })
  })

  it('does not group distinct evidence tuples when a hostile field contains a legacy delimiter', () => {
    const resolution = evaluateDirectoryResolution({
      request: { platformSubjectVerified: true, tipCardValid: true, subjectCommitment: 'sha256:subject-a' },
      policy: { attesterThreshold: 2, rootThreshold: 3, replicaQuorum: 2 },
      evidence: [
        {
          ...commonEvidence,
          bundleHash: 'sha256:bundle-a\u000011111111111111111111111111111111',
          walletAddress: 'sha256:status-a',
          statusRecordHash: 'sha256:root-a',
          root: { ...commonEvidence.root, certificateHash: 'sha256:certificate-a' },
          replicaFailureDomain: 'replica-a'
        },
        {
          ...commonEvidence,
          bundleHash: 'sha256:bundle-a',
          walletAddress: '11111111111111111111111111111111',
          statusRecordHash: 'sha256:status-a',
          root: { ...commonEvidence.root, certificateHash: 'sha256:root-a\u0000sha256:certificate-a' },
          replicaFailureDomain: 'replica-b'
        }
      ]
    })

    expect(resolution).toEqual({ kind: 'DIRECTORY_UNAVAILABLE', reason: 'REPLICA_QUORUM_NOT_MET' })
  })
})
