/**
 * Kitchen PINs, for passing a shared device between people. Only a slow, salted
 * hash is kept, never the PIN itself. A team member's device could still guess
 * a short PIN from its hash given time, so a PIN is for knowing who's at the
 * tablet, not a password: accounts and managers are what the server trusts.
 */

const ITERATIONS = 150_000
const PREFIX = 'pbkdf2-sha256'

export const PIN_PATTERN = /^\d{4,6}$/

const toBase64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = toBase64(await derive(pin, salt, ITERATIONS))
  return [PREFIX, String(ITERATIONS), toBase64(salt), hash].join('$')
}

export async function checkPin(pin: string, stored: string | undefined): Promise<boolean> {
  const [prefix, iterations, salt, hash] = stored?.split('$') ?? []
  if (prefix !== PREFIX || !salt || !hash) return false
  const attempt = new Uint8Array(await derive(pin, fromBase64(salt), Number(iterations)))
  const expected = fromBase64(hash)
  // Compared in full every time, so how long it takes says nothing about how close a guess was.
  let difference = attempt.length ^ expected.length
  for (let i = 0; i < Math.min(attempt.length, expected.length); i++) difference |= attempt[i] ^ expected[i]
  return difference === 0
}
