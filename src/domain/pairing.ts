import { createHash } from 'node:crypto'

import { z } from 'zod'

import { DomainError } from './errors.js'
import { supportedPlatforms } from './models.js'

export const platformActorSchema = z.object({
  platform: z.enum(supportedPlatforms),
  platformUserId: z.string().trim().min(1).max(128)
})

export const createIdentitySchema = platformActorSchema.extend({
  displayName: z.string().trim().min(1).max(80)
})

export const consumePairingSchema = platformActorSchema.extend({
  code: z.string().trim().min(8).max(128)
})

export const issuePairingSchema = z.object({
  actor: platformActorSchema,
  targetPlatform: z.enum(supportedPlatforms)
})

export const confirmPairingSchema = z.object({
  actor: platformActorSchema,
  requestId: z.string().uuid()
})

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new DomainError('VALIDATION_ERROR', 'The supplied command input is not valid.')
  }
  return result.data
}

export function normalizePairingCode(rawCode: string): string {
  return rawCode.trim().toUpperCase()
}

export function hashPairingCode(rawCode: string): string {
  return createHash('sha256').update(normalizePairingCode(rawCode)).digest('base64url')
}
