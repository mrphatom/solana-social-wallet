import { DomainError } from '../domain/errors.js'
import type { Platform, PlatformActor } from '../domain/models.js'
import type { AccountService } from '../application/account-service.js'

export type LocalChatCommand =
  | { type: 'CREATE_ACCOUNT' }
  | { type: 'ISSUE_PAIRING'; targetPlatform: Platform }
  | { type: 'REQUEST_PAIRING'; code: string }
  | { type: 'CONFIRM_PAIRING'; requestId: string }

/**
 * Represents output from a provider-specific verified adapter. It is deliberately
 * not a raw Discord or Telegram payload and carries no webhook/token material.
 */
export interface VerifiedLocalChatEvent extends PlatformActor {
  displayName: string
  command: LocalChatCommand
}

export type LocalChatReply =
  | { kind: 'ACCOUNT_CREATED'; accountId: string }
  | { kind: 'PAIRING_CODE_ISSUED'; code: string; expiresAt: Date }
  | { kind: 'PAIRING_CONFIRMATION_PENDING'; requestId: string }
  | { kind: 'PAIRING_CONFIRMED' }
  | { kind: 'COMMAND_REJECTED'; code: string; message: string }

export interface LocalChatRuntimeDependencies {
  accounts: AccountService
}

function toSafeReply(error: unknown): LocalChatReply {
  if (error instanceof DomainError) {
    const safeMessages: Record<DomainError['code'], string> = {
      IDENTITY_ALREADY_LINKED: 'This chat identity is already linked to a shared account.',
      INTERNAL_TRANSFER_OPT_IN_REQUIRED: 'The recipient has not enabled internal transfers.',
      INVALID_SOLANA_ADDRESS: 'The Solana address is not valid.',
      INVALID_TRANSFER_AMOUNT: 'The transfer amount is not valid.',
      PAIRING_CODE_EXPIRED: 'That pairing code has expired.',
      PAIRING_CODE_INVALID: 'That pairing code is not valid.',
      PAIRING_CODE_REPLAYED: 'That pairing code was already used.',
      PAIRING_CODE_TARGET_PLATFORM_MISMATCH: 'Use the pairing code in the platform it was issued for.',
      PAIRING_REQUEST_EXPIRED: 'That pairing request has expired.',
      PAIRING_REQUEST_INVALID: 'That pairing request is not available.',
      PAIRING_REQUEST_NOT_AUTHORIZED: 'Only the identity that started pairing can confirm it.',
      PAIRING_SOURCE_NOT_FOUND: 'Create a shared account before using this command.',
      PAIRING_TARGET_PLATFORM_MUST_DIFFER: 'Choose the other supported chat platform for pairing.',
      RECIPIENT_NOT_FOUND: 'That recipient is not available for an internal transfer.',
      SELF_TRANSFER_NOT_ALLOWED: 'Choose a different verified recipient.',
      SENDER_WALLET_NOT_FOUND: 'Link a verified Solana wallet first.',
      TARGET_IDENTITY_ALREADY_LINKED: 'This chat identity is already linked to an account.',
      VALIDATION_ERROR: 'The command input is not valid.',
      WALLET_ADDRESS_ALREADY_BOUND: 'That Solana wallet is linked to another shared account.',
      WALLET_PROOF_INVALID: 'Wallet ownership could not be verified.'
    }
    return { kind: 'COMMAND_REJECTED', code: error.code, message: safeMessages[error.code] }
  }
  return { kind: 'COMMAND_REJECTED', code: 'UNEXPECTED_ERROR', message: 'The request could not be completed safely.' }
}

export function createLocalChatRuntime(dependencies: LocalChatRuntimeDependencies) {
  async function handle(event: VerifiedLocalChatEvent): Promise<LocalChatReply> {
    const actor = { platform: event.platform, platformUserId: event.platformUserId }
    try {
      switch (event.command.type) {
        case 'CREATE_ACCOUNT': {
          const account = await dependencies.accounts.createAccountFromIdentity({ ...actor, displayName: event.displayName })
          return { kind: 'ACCOUNT_CREATED', accountId: account.id }
        }
        case 'ISSUE_PAIRING': {
          const pairing = await dependencies.accounts.issuePairingCode({ actor, targetPlatform: event.command.targetPlatform })
          return { kind: 'PAIRING_CODE_ISSUED', code: pairing.code, expiresAt: pairing.expiresAt }
        }
        case 'REQUEST_PAIRING': {
          const request = await dependencies.accounts.requestPairing({ actor, code: event.command.code })
          return { kind: 'PAIRING_CONFIRMATION_PENDING', requestId: request.id }
        }
        case 'CONFIRM_PAIRING':
          await dependencies.accounts.confirmPairingRequest({ actor, requestId: event.command.requestId })
          return { kind: 'PAIRING_CONFIRMED' }
      }
    } catch (error: unknown) {
      return toSafeReply(error)
    }
  }

  return { handle }
}
