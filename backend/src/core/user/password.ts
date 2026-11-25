import { randomBytes, scrypt, timingSafeEqual } from 'crypto'

export const MIN_PASSWORD_LENGTH = 8

const KEYLEN = 64
const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => scrypt(password, salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key))))

/** "scrypt$<salt hex>$<hash hex>". A fresh random salt per password. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('hex')}$${(await derive(password, salt)).toString('hex')}`
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [scheme, salt, hash] = (stored ?? '').split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = await derive(password, Buffer.from(salt, 'hex'))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
