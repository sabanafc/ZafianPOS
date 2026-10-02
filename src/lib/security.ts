// Keamanan akses halaman Keuangan: PIN (SHA-256) & TOTP (Google Authenticator)

/** Hash SHA-256 hex dari gabungan teks */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Hash PIN — diberi salt tetap agar tidak bisa dibalik dari hash saja */
export function pinHash(pin: string): Promise<string> {
  return sha256Hex('zafian-pos-pin:' + pin)
}

/** Base32 decode (RFC 4648, tanpa spasi/pemisah) → bytes */
export function base32Decode(s: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/** HMAC-SHA1 (untuk TOTP) via Web Crypto */
async function hmacSha1(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as unknown as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msg as unknown as BufferSource)
  return new Uint8Array(sig)
}

/** Kode TOTP 6 digit saat ini (window 30 detik) */
export async function totpNow(secretBase32: string, atMs = Date.now()): Promise<string> {
  const key = base32Decode(secretBase32)
  const counter = Math.floor(atMs / 1000 / 30)
  const msg = new Uint8Array(8)
  let c = counter
  for (let i = 7; i >= 0; i--) {
    msg[i] = c & 0xff
    c = Math.floor(c / 256)
  }
  const h = await hmacSha1(key, msg)
  const offset = h[h.length - 1] & 0x0f
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3]
  return String(bin % 1_000_000).padStart(6, '0')
}

/** Verifikasi kode TOTP dengan toleransi ±1 window (30 detik) */
export async function verifyTotp(secretBase32: string, code: string): Promise<boolean> {
  const clean = code.replace(/\D/g, '')
  if (clean.length !== 6) return false
  const now = Date.now()
  for (const drift of [-30_000, 0, 30_000]) {
    if (await totpNow(secretBase32, now + drift) === clean) return true
  }
  return false
}

/** Generate secret base32 acak (20 byte) untuk setup Google Authenticator */
export function generateTotpSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += alphabet[b % 32]
  return out
}

/** URL otpauth untuk QR / link Google Authenticator */
export function otpauthUrl(secret: string, label: string, issuer: string): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}
