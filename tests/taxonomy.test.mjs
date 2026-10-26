// Filter semantics for the technical taxonomy (docs/technical-taxonomy.md §8).
// Run with `npm test`. Uses the illustrative archetypes from the handoff (§9).
import { test } from "node:test"
import assert from "node:assert/strict"
import { techMatches, facetMatches, childrenIndex, withDescendants, UNCLASSIFIED, EMPTY_TECH_SELECTION } from "../lib/taxonomy.ts"

const kids = childrenIndex([
  { slug: "autonomous_research_agents", parentSlug: "ai_agents" },
  { slug: "autonomous_scientific_agents", parentSlug: "autonomous_research_agents" },
  { slug: "coding_agents", parentSlug: "ai_agents" },
])

const t = (slug, facet, kind = "develops") => ({ slug, facet, kind })

const researchAgent = {
  primaryLayer: "agent_infrastructure_orchestration",
  secondaryLayers: [],
  terms: [
    t("autonomous_scientific_agents", "specialization"),
    t("agent_orchestration", "specialization"),
    t("planning_tool_use", "method", "uses"),
    t("scientific_research", "domain"),
  ],
}
const compBio = {
  primaryLayer: "ai_native_applications",
  secondaryLayers: ["foundation_models"],
  terms: [
    t("bioinformatics", "specialization"),
    t("mechanistic_biology", "specialization"),
    t("predictive_modeling", "method", "uses"),
    t("genomic_data", "modality", "uses"),
    t("clinical_records_data", "modality", "uses"),
  ],
}
const inference = {
  primaryLayer: "inference_optimization",
  secondaryLayers: [],
  terms: [t("model_routing", "specialization"), t("inference_optimization", "specialization")],
}
const llmWrapper = {
  primaryLayer: "ai_native_applications",
  secondaryLayers: [],
  terms: [t("large_language_models", "specialization", "uses"), t("model_routing", "specialization", "uses")],
}
const stealth = { primaryLayer: null, secondaryLayers: [], terms: [] }
const all = { researchAgent, compBio, inference, llmWrapper, stealth }

const sel = (s) => ({ ...EMPTY_TECH_SELECTION, ...s })
const matching = (s) => Object.entries(all).filter(([, v]) => techMatches(v, sel(s), kids)).map(([k]) => k)

test("no technical filter matches everyone", () => {
  assert.deepEqual(matching({}), Object.keys(all))
})

test("example 1: agent infrastructure AND autonomous scientific agents", () => {
  assert.deepEqual(matching({ layer: ["agent_infrastructure_orchestration"], spec: ["autonomous_scientific_agents"] }), ["researchAgent"])
})

test("example 2: bioinformatics OR mechanistic biology, AND genomic and/or clinical data", () => {
  assert.deepEqual(matching({ spec: ["bioinformatics", "mechanistic_biology"], modality: ["genomic_data", "clinical_records_data"] }), ["compBio"])
})

test("example 3: developing model routing excludes apps that merely use it", () => {
  assert.deepEqual(matching({ spec: ["model_routing"] }), ["inference", "llmWrapper"])
  assert.deepEqual(matching({ spec: ["model_routing"], developsOnly: true }), ["inference"])
})

test("within a facet values are OR, across facets AND", () => {
  assert.deepEqual(matching({ spec: ["bioinformatics", "model_routing"] }), ["compBio", "inference", "llmWrapper"])
  assert.deepEqual(matching({ spec: ["bioinformatics"], domain: ["scientific_research"] }), [])
})

test("primary layer filter ignores secondary layers unless asked", () => {
  assert.deepEqual(matching({ layer: ["foundation_models"] }), [])
  assert.deepEqual(matching({ layer: ["foundation_models"], includeSecondary: true }), ["compBio"])
})

test("umbrella terms match narrower ones", () => {
  assert.deepEqual(matching({ spec: ["ai_agents"] }), ["researchAgent"])
  assert.deepEqual([...withDescendants(["ai_agents"], kids)].sort(), ["ai_agents", "autonomous_research_agents", "autonomous_scientific_agents", "coding_agents"])
})

test("unclassified startups never match a selected term, only the explicit Unclassified option", () => {
  assert.ok(!techMatches(stealth, sel({ layer: ["ai_native_applications"] }), kids))
  assert.ok(!facetMatches(stealth, "specialization", ["bioinformatics"], kids))
  assert.deepEqual(matching({ layer: [UNCLASSIFIED] }), ["stealth"])
  assert.deepEqual(matching({ modality: [UNCLASSIFIED] }), ["researchAgent", "inference", "llmWrapper", "stealth"])
  assert.deepEqual(matching({ layer: [UNCLASSIFIED, "inference_optimization"] }), ["inference", "stealth"])
})

test("developsOnly does not apply to modalities or domains", () => {
  assert.deepEqual(matching({ modality: ["genomic_data"], developsOnly: true }), ["compBio"])
})
