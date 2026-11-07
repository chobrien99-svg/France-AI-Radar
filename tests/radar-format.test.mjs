// Money display helpers (lib/radar.ts). Run with `npm test`.
import { test } from "node:test"
import assert from "node:assert/strict"
import { eurFromMillions, formatEur, formatEurMillions } from "../lib/radar.ts"

test("total raised is stored in € millions and shown as such", () => {
  assert.equal(formatEurMillions(6), "€6.0M") // Uncovr: 6.00 = €6M, not €6
  assert.equal(formatEurMillions("5.00"), "€5.0M") // Postgres NUMERIC can arrive as a string
  assert.equal(formatEurMillions(0.5), "€500K")
  assert.equal(formatEurMillions(1.25), "€1.3M")
  assert.equal(formatEurMillions(null), "Undisclosed")
  assert.equal(formatEurMillions(0), "Undisclosed")
})

test("eurFromMillions converts to whole euros without float noise", () => {
  assert.equal(eurFromMillions(1.2), 1_200_000)
  assert.equal(eurFromMillions(0.03), 30_000)
  assert.equal(eurFromMillions(null), null)
  assert.equal(eurFromMillions(""), null)
  assert.equal(eurFromMillions("abc"), null)
})

test("formatEur still takes whole euros", () => {
  assert.equal(formatEur(6_000_000), "€6.0M")
  assert.equal(formatEur(30_000), "€30K")
})
