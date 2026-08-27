import { generateKeyPairSync, sign } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { verifyDiscordInteraction, verifyTelegramWebhook } from '../src/adapters/webhook-verification.js'

describe('Webhook verification', () => {
  it('accepts only an Ed25519 signature over the exact Discord timestamp and raw body', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519')
    const rawPublicKey = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex')
    const timestamp = '1787830900'
    const rawBody = '{"type":1}'
    const signature = sign(null, Buffer.from(`${timestamp}${rawBody}`), privateKey).toString('hex')

    expect(verifyDiscordInteraction({ rawPublicKey, timestamp, rawBody, signature })).toBe(true)
    expect(verifyDiscordInteraction({ rawPublicKey, timestamp, rawBody: '{"type":2}', signature })).toBe(false)
  })

  it('accepts only the configured Telegram webhook secret', () => {
    expect(verifyTelegramWebhook({ expectedSecret: 'test-webhook-secret', receivedSecret: 'test-webhook-secret' })).toBe(true)
    expect(verifyTelegramWebhook({ expectedSecret: 'test-webhook-secret', receivedSecret: 'other-secret' })).toBe(false)
    expect(verifyTelegramWebhook({ expectedSecret: 'test-webhook-secret', receivedSecret: undefined })).toBe(false)
  })
})
