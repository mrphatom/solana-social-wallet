export type DomainErrorCode =
  | 'IDENTITY_ALREADY_LINKED'
  | 'PAIRING_CODE_TARGET_PLATFORM_MISMATCH'
  | 'PAIRING_CODE_EXPIRED'
  | 'PAIRING_CODE_INVALID'
  | 'PAIRING_CODE_REPLAYED'
  | 'PAIRING_REQUEST_EXPIRED'
  | 'PAIRING_REQUEST_INVALID'
  | 'PAIRING_REQUEST_NOT_AUTHORIZED'
  | 'PAIRING_SOURCE_NOT_FOUND'
  | 'TARGET_IDENTITY_ALREADY_LINKED'
  | 'VALIDATION_ERROR'

export class DomainError extends Error {
  public readonly code: DomainErrorCode

  public constructor(code: DomainErrorCode, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}
