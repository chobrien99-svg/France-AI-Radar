// organizations.total_raised_eur and funding_rounds.amount_eur are stored in
// millions of euros (shared with the Navigator); people and import files use whole euros.
import { test } from "node:test"
import assert from "node:assert/strict"
import { EUR_MILLIONS_UNIT, toStoredMillions, fromStoredMillions } from "../lib/money.ts"
import { formatEur, formatEurMillions } from "../lib/radar.ts"

test("whole euros are stored as millions, rounded to the column's 2 decimals", () => {
  assert.equal(EUR_MILLIONS_UNIT, 1_000_000)
  assert.equal(toStoredMillions(5_000_000), 5)
  assert.equal(toStoredMillions(1_500_000), 1.5)
  assert.equal(toStoredMillions(90_000), 0.09)
  assert.equal(toStoredMillions(125_000), 0.13)
  assert.equal(toStoredMillions("6000000"), 6, "form values arrive as strings")
})

test("empty or unreadable amounts are stored as null, never 0", () => {
  for (const v of [null, undefined, "", "abc", NaN]) assert.equal(toStoredMillions(v), null)
})

test("stored millions read back as whole euros, including Postgres numeric strings", () => {
  assert.equal(fromStoredMillions(5), 5_000_000)
  assert.equal(fromStoredMillions("6.00"), 6_000_000)
  assert.equal(fromStoredMillions(0.09), 90_000)
  assert.equal(fromStoredMillions(0.29), 290_000, "no floating-point dust")
  assert.equal(fromStoredMillions(null), null)
  assert.equal(fromStoredMillions(""), null)
})

test("the admin form round-trips: prefill in euros, save back in millions", () => {
  for (const stored of [0.09, 1.5, 5, 6, 12.34]) {
    assert.equal(toStoredMillions(String(fromStoredMillions(stored))), stored)
  }
})

test("a stored total is displayed in millions, not as a few euros", () => {
  assert.equal(formatEurMillions(6), "€6.0M")
  assert.equal(formatEurMillions("5.00"), "€5.0M")
  assert.equal(formatEurMillions(0.09), "€90K")
  assert.equal(formatEurMillions(null), "Undisclosed")
  assert.equal(formatEurMillions(0), "Undisclosed")
  assert.equal(formatEur(6), "€6", "formatEur itself still takes whole euros")
})
