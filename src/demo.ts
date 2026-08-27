import { MemorySocialRepository } from './adapters/memory-social-repository.js'
import { createLocalChatRuntime } from './adapters/local-chat-runtime.js'
import { createAccountService } from './application/account-service.js'
import { getCapabilityAvailability } from './domain/capability-policy.js'

const repository = new MemorySocialRepository()
const accounts = createAccountService({
  repository,
  clock: () => new Date('2026-08-27T12:00:00.000Z'),
  codeGenerator: () => 'local-demo-pairing-code'
})
const runtime = createLocalChatRuntime({ accounts })

const source = { platform: 'discord' as const, platformUserId: 'demo-discord-user', displayName: 'Demo sender' }
const target = { platform: 'telegram' as const, platformUserId: 'demo-telegram-user', displayName: 'Demo recipient' }

await runtime.handle({ ...source, command: { type: 'CREATE_ACCOUNT' } })
const pairing = await runtime.handle({ ...source, command: { type: 'ISSUE_PAIRING', targetPlatform: 'telegram' } })
if (pairing.kind !== 'PAIRING_CODE_ISSUED') throw new Error('Local pairing demonstration could not issue a code.')

const pending = await runtime.handle({ ...target, command: { type: 'REQUEST_PAIRING', code: pairing.code } })
if (pending.kind !== 'PAIRING_CONFIRMATION_PENDING') throw new Error('Local pairing demonstration could not create a request.')

const confirmation = await runtime.handle({ ...source, command: { type: 'CONFIRM_PAIRING', requestId: pending.requestId } })
if (confirmation.kind !== 'PAIRING_CONFIRMED') throw new Error('Local pairing demonstration could not confirm a request.')

console.info(
  JSON.stringify({
    event: 'local_demo_complete',
    sharedSpace: 'discord_and_telegram_linked',
    assetExecution: 'disabled_without_wallet_approval_bridge',
    buyCapability: getCapabilityAvailability('BUY').state,
    mode: 'credential_free'
  })
)
