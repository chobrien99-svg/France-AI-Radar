#!/usr/bin/env node
// Issue an Enterprise API key (Stage 1 pilot keys).
//
//   node scripts/api-key.mjs <label>
//
// Prints the key once (give it to the customer over a secure channel) and
// the entry to add to the ENTERPRISE_API_KEYS environment variable on Vercel
// ("label:sha256", comma-separated for several keys). Only the hash is
// stored; the key can't be recovered from it. To revoke, remove the entry.
import { createHash, randomBytes } from "node:crypto"

const label = (process.argv[2] ?? "").trim()
if (!/^[a-z0-9][a-z0-9_-]{1,40}$/.test(label)) {
  console.error("Usage: node scripts/api-key.mjs <label>   (lowercase letters, digits, - or _, e.g. acme-ventures)")
  process.exit(1)
}
const key = "far_live_" + randomBytes(24).toString("base64url")
const hash = createHash("sha256").update(key, "utf8").digest("hex")
console.log(`API key (shown once):   ${key}`)
console.log(`ENTERPRISE_API_KEYS entry:   ${label}:${hash}`)
