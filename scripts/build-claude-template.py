#!/usr/bin/env python3
"""Builds docs/claude-project/France_AI_Radar_Startup_Template.md, the Claude Project
instructions for drafting startup profiles, from:
  - docs/claude-project/template-source.md   (instructions and output format)
  - supabase/migrations/*technical_taxonomy*  (layers, terms, aliases, parents)
  - docs/claude-project/sectors.json          (sector names, as in the sectors table)
  - tests/fixtures/startup-draft.example.json (the import-block example)

Run after changing any of them:  python3 scripts/build-claude-template.py
"""
import json, re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
m1 = open(f"{root}/supabase/migrations/20261025_technical_taxonomy.sql").read()
m2 = open(f"{root}/supabase/migrations/20261026_technical_taxonomy_choices.sql").read()
q = r"'((?:[^']|'')*)'"
val = rf"(?:{q}|NULL)"
term_re = re.compile(rf"^\s*\({q}, {q}, '(specialization|method|modality|domain)', {val}, (\d+), {val}\)", re.M)
terms = {}
for src in (m1, m2):
    for slug, label, facet, family, order, d in term_re.findall(src):
        terms[slug] = dict(slug=slug, label=label, facet=facet, family=family or None, order=int(order), d=d or None, aliases=[], parent=None)
layer_re = re.compile(rf"^\s*\({q}, {q}, {q}, (\d+)\)", re.M)
layers = [dict(slug=s, label=l, d=d) for s, l, d, _ in layer_re.findall(m1.split("Seed: primary layers")[1])]
def alias_pairs(src):
    blk = src.split("INSERT INTO technical_term_aliases")[1].split(") AS a(slug, alias)")[0]
    return re.findall(rf"\({q}, {q}\)", blk)
deleted = set(re.findall(r"'([^']+)'", m2.split("DELETE FROM technical_term_aliases")[1].split(");")[0]))
for src in (m1, m2):
    for slug, a in alias_pairs(src):
        if a.lower() not in deleted:
            terms[slug]["aliases"].append(a)
for c, p in re.findall(rf"\({q}, {q}\)", m1.split("SET parent_term_id")[1].split(") AS link")[0]):
    terms[c]["parent"] = terms[p]["label"]


d = {"layers": layers, "terms": sorted(terms.values(), key=lambda t: t["order"])}
FAMILIES = [
    ("foundation_models", "Foundation models & architectures"),
    ("agents", "Agents & agentic systems"),
    ("data_knowledge_reasoning", "Data, knowledge & reasoning"),
    ("infrastructure_optimization", "Infrastructure & optimization"),
    ("science_biology_healthcare", "Science, biology & healthcare"),
    ("physical_ai_industrial", "Physical AI & industrial intelligence"),
]
SECTORS = json.load(open(f"{root}/docs/claude-project/sectors.json"))
head = open(f"{root}/docs/claude-project/template-source.md").read().rstrip()
example = open(f"{root}/tests/fixtures/startup-draft.example.json").read().strip()
out = [head.replace("{{EXAMPLE_JSON}}", example), ""]

def row(t):
    syn = ", ".join(t["aliases"]) or "—"
    d_ = (t["d"] or "—").replace("|", "/")
    if t["parent"]:
        d_ += f" *(narrower term of {t['parent']})*"
    return f"| {t['label']} | {d_} | {syn} |"

out += ["### 4.1 Technical layers (Primary and Secondary)", "", "| Layer | Covers |", "|---|---|"]
out += [f"| {l['label']} | {l['d']} |" for l in d["layers"]]
out += ["", "### 4.2 Technical specializations (grouped by family as in the editor)", ""]
for fam, name in FAMILIES:
    out += [f"**{name}**", "", "| Term | Definition | Synonyms (for matching document wording) |", "|---|---|---|"]
    out += [row(t) for t in d["terms"] if t["facet"] == "specialization" and t["family"] == fam]
    out.append("")
for facet, title in [("method", "4.3 Core AI methods"), ("modality", "4.4 Data modalities"), ("domain", "4.5 Target scientific / technical domains")]:
    out += [f"### {title}", "", "| Term | Definition | Synonyms |", "|---|---|---|"]
    out += [row(t) for t in d["terms"] if t["facet"] == facet]
    out.append("")
out += [
    "### 4.6 Other dropdown values",
    "",
    "| Field | Allowed values |",
    "|---|---|",
    "| Relationship (per term) | Develops · Uses · Researches |",
    "| Evidence status (per term, layer, claim) | Verified · Reported · Inferred · Unverified |",
    "| AI product role | Infrastructure · Platform · Application |",
    "| Technology positioning | Frontier technology developer · Enabling infrastructure · AI-native platform · Vertical AI application · AI-enabled software · Research commercialization |",
    "| Technology maturity | Research · Prototype · Beta · Commercial |",
    "| Proprietary technology | Own model · Proprietary dataset · Proprietary algorithm · Patented technology · Proprietary hardware · Open-source core · Third-party models only |",
    "| Status | Draft (not visible) · Published (live) · Inactive (hidden) · Archived |",
    "| Fundraising status | Unknown · Not raising · Exploring · Actively raising · Closing · Recently closed |",
    "| Signal tag strength | Strong · Moderate · Neutral · Weak |",
    "",
    "### 4.7 Sectors (market served)",
    "",
    " · ".join(SECTORS),
    "",
    "---",
    "",
    "*Maintenance: regenerate Part 4 whenever terms are added or retired in Supabase (`technical_terms`, `technical_layers`, `sectors`). Retired terms must not be suggested.*",
    "",
]
open(f"{root}/docs/claude-project/France_AI_Radar_Startup_Template.md", "w").write("\n".join(out))
