// API keys for the Enterprise API, Stage 1 (pilot) version.
//
// Keys are issued by hand with `node scripts/api-key.mjs <label>` and only
// their SHA-256 hash is stored, in the ENTERPRISE_API_KEYS environment
// variable on Vercel: "label:hash,label:hash". A raw key is never stored or
// logged. While the variable is empty the whole /v1 API answers 404, so
// deploying this code exposes nothing until a key is configured.
//
// Stage 3 replaces this with per-customer keys in the database (expiry,
// revocation, scopes, usage). Revoking a key today = removing its entry.
import { createHash, timingSafeEqual } from "node:crypto"

export type KeyEntry = { label: string; hash: string }

export const KEY_PREFIX = "far_live_"

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex")
}

/** "label:hash,label:hash" → entries. Malformed entries are skipped. */
export function parseKeyConfig(value: string | undefined | null): KeyEntry[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.lastIndexOf(":")
      return { label: part.slice(0, i).trim(), hash: part.slice(i + 1).trim().toLowerCase() }
    })
    .filter((e) => e.label && /^[0-9a-f]{64}$/.test(e.hash))
}

/** The bearer token from an Authorization header, or null. */
export function bearerToken(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "")
  return m ? m[1] : null
}

/** The label of the matching key, or null. Compares hashes in constant time. */
export function authenticate(token: string | null, keys: KeyEntry[]): string | null {
  if (!token || !token.startsWith(KEY_PREFIX) || token.length > 200) return null
  const given = Buffer.from(hashKey(token), "hex")
  let found: string | null = null
  for (const k of keys) {
    const want = Buffer.from(k.hash, "hex")
    if (want.length === given.length && timingSafeEqual(want, given)) found = k.label
  }
  return found
}
