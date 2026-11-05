// Link-preview text for startup pages (lib/share-meta.ts). Run with `npm test`.
import { test } from "node:test"
import assert from "node:assert/strict"
import { shareText, shareDescription, titleFit } from "../lib/share-meta.ts"

test("shareText collapses whitespace and cuts long text at a word boundary", () => {
  assert.equal(shareText("  Hello\n  world  "), "Hello world")
  assert.equal(shareText(""), null)
  assert.equal(shareText(null), null)
  const long = "Granit builds sovereign AI infrastructure for European industry, with on-premise models, private data pipelines and agents that run inside customer networks."
  const cut = shareText(long, 80)
  assert.ok(cut.length <= 80, cut)
  assert.ok(cut.endsWith("…"))
  assert.ok(!cut.includes("  "))
  assert.equal(cut, "Granit builds sovereign AI infrastructure for European industry, with…")
})

test("shareDescription uses the company's own line, otherwise a neutral sentence from public facts", () => {
  assert.equal(shareDescription({ name: "Granit", slug: "granit", description: "Sovereign AI for industry.", sector: "DeepTech", place: "Paris" }), "Sovereign AI for industry.")
  assert.equal(shareDescription({ name: "Granit", slug: "granit", description: null, sector: "DeepTech", place: "Paris" }), "Granit: DeepTech startup based in Paris, tracked by France AI Radar.")
  assert.equal(shareDescription({ name: "Granit", slug: "granit", description: "  ", sector: null, place: null }), "Granit: AI startup, tracked by France AI Radar.")
})

test("share card titles shrink with length and are capped at 60 characters", async () => {
  assert.deepEqual(titleFit("Granit"), { text: "Granit", fontSize: 96 })
  assert.equal(titleFit("Société Générative Intelligence").fontSize, 72)
  const long = titleFit("Institut de Recherche Technologique pour l'Intelligence Artificielle Souveraine Européenne")
  assert.equal(long.fontSize, 56)
  assert.ok(long.text.length <= 60 && long.text.endsWith("…"))
})
