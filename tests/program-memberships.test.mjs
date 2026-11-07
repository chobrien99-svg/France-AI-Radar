// Private programme memberships on startup pages and CSV exports
// (lib/program-memberships.ts). Run with `npm test`.
import { test } from "node:test"
import assert from "node:assert/strict"
import { programMemberships } from "../lib/program-memberships.ts"

const row = (id, { member, edition, programme } = {}) => ({
  id,
  membership_role: "member",
  verification_status: member ?? "verified",
  program_editions: {
    name: `Edition ${id}`, cohort_label: `Batch ${id}`, year: 2026, verification_status: edition ?? null,
    programs: [{ name: `Programme ${id}`, program_type: "accelerator", verification_status: programme ?? null }],
  },
})

const rows = [
  row("public"),
  row("private-member", { member: "private" }),
  row("private-edition", { edition: "private" }),
  row("private-programme", { programme: "private" }),
]

test("non-admins never see memberships marked private on the membership, edition or programme", () => {
  const out = programMemberships(rows, false)
  assert.deepEqual(out.map((p) => p.id), ["public"])
  assert.equal(out[0].isPrivate, false)
  assert.equal(out[0].program_name, "Programme public")
  assert.equal(out[0].edition_label, "Batch public")
})

test("admins see every membership, with private ones flagged", () => {
  const out = programMemberships(rows, true)
  assert.deepEqual(out.map((p) => [p.id, p.isPrivate]), [
    ["public", false], ["private-member", true], ["private-edition", true], ["private-programme", true],
  ])
})

test("missing data is handled", () => {
  assert.deepEqual(programMemberships(null, false), [])
  const [p] = programMemberships([{ id: "x", membership_role: null, verification_status: null, program_editions: null }], false)
  assert.equal(p.program_name, "Unknown")
  assert.equal(p.edition_label, null)
})
