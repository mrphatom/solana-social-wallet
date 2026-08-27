const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const base58Index = new Map([...base58Alphabet].map((character, index) => [character, index]))

/**
 * Validates the byte length only. Ownership is proven through the injected verifier,
 * so this parser cannot accidentally be treated as wallet-control verification.
 */
export function isSolanaPublicKey(value: string): boolean {
  if (value.length < 32 || value.length > 44) return false
  const bytes = [0]

  for (const character of value) {
    const digit = base58Index.get(character)
    if (digit === undefined) return false
    let carry = digit
    for (let index = bytes.length - 1; index >= 0; index -= 1) {
      const next = bytes[index]! * 58 + carry
      bytes[index] = next & 0xff
      carry = next >> 8
    }
    while (carry > 0) {
      bytes.unshift(carry & 0xff)
      carry >>= 8
    }
  }

  let leadingZeroes = 0
  for (const character of value) {
    if (character !== '1') break
    leadingZeroes += 1
  }
  const decodedLength = bytes.length + leadingZeroes - (bytes.length === 1 && bytes[0] === 0 ? 1 : 0)
  return decodedLength === 32
}
