import { createPublicKey, timingSafeEqual, verify } from 'node:crypto'

const ed25519SpkiPrefix = Buffer.from('302a300506032b6570032100', 'hex')

export interface DiscordInteractionVerificationInput {
  rawPublicKey: string
  timestamp: string
  rawBody: string
  signature: string
}

export interface TelegramWebhookVerificationInput {
  expectedSecret: string
  receivedSecret: string | undefined
}

/**
 * Discord validates the signature over the exact timestamp concatenated with the
 * unparsed body. Call this before JSON parsing a future HTTP interaction request.
 */
export function verifyDiscordInteraction(input: DiscordInteractionVerificationInput): boolean {
  if (!/^[a-f0-9]{64}$/i.test(input.rawPublicKey)) return false
  if (!/^[a-f0-9]{128}$/i.test(input.signature)) return false
  if (input.timestamp.length === 0 || input.rawBody.length > 1_000_000) return false

  try {
    const publicKey = createPublicKey({
      key: Buffer.concat([ed25519SpkiPrefix, Buffer.from(input.rawPublicKey, 'hex')]),
      format: 'der',
      type: 'spki'
    })
    return verify(null, Buffer.from(`${input.timestamp}${input.rawBody}`), publicKey, Buffer.from(input.signature, 'hex'))
  } catch {
    return false
  }
}

/**
 * Avoids a simple early-exit string comparison for a configured Telegram secret.
 * Secrets remain runtime configuration and must never be written to code or logs.
 */
export function verifyTelegramWebhook(input: TelegramWebhookVerificationInput): boolean {
  if (input.receivedSecret === undefined) return false
  const expected = Buffer.from(input.expectedSecret, 'utf8')
  const received = Buffer.from(input.receivedSecret, 'utf8')
  if (expected.length === 0 || expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}
