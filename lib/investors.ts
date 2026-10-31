import type { SupabaseClient } from "@supabase/supabase-js"

// Investors are organizations of type "investor", shared with the Navigator
// (about 5,000 of them). A round links to them through funding_round_investors.

export type InvestorLink = { investor_id: string; name: string; is_lead: boolean }

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()

/** Up to 8 investors whose name contains `q`, for the editor's suggestions. */
export async function searchInvestors(svc: SupabaseClient, q: string): Promise<{ id: string; name: string }[]> {
  const term = q.trim().replace(/[%_]/g, "")
  if (term.length < 2) return []
  const { data } = await svc
    .from("organizations")
    .select("id, name")
    .eq("organization_type", "investor")
    .ilike("name", `%${term}%`)
    .order("name")
    .limit(8)
  return (data ?? []) as { id: string; name: string }[]
}

async function uniqueOrgSlug(svc: SupabaseClient, name: string): Promise<string> {
  const base = fold(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "investor"
  for (let n = 0; ; n++) {
    const slug = n ? `${base}-${n}` : base
    const { data } = await svc.from("organizations").select("id").eq("slug", slug).maybeSingle()
    if (!data) return slug
  }
}

/**
 * The investor with this name (case, accents and spacing ignored), created
 * in the shared list when there is none, so the next time it is matched
 * rather than duplicated.
 */
export async function findOrCreateInvestor(svc: SupabaseClient, rawName: string): Promise<{ id: string; name: string; created: boolean }> {
  const name = rawName.replace(/\s+/g, " ").trim()
  if (!name) throw new Error("Investor name is empty")
  // Vowels and c may carry accents ("Élaia" / "Elaia"): let them match any
  // one letter in the database query, then compare exactly once folded.
  const pattern = fold(name).replace(/[%_\\]/g, "").replace(/[aeiouyc]/g, "_")
  const { data: candidates } = await svc
    .from("organizations")
    .select("id, name")
    .eq("organization_type", "investor")
    .ilike("name", pattern)
    .limit(50)
  const match = ((candidates ?? []) as { id: string; name: string }[]).find((c) => fold(c.name) === fold(name))
  if (match) return { ...match, created: false }
  const slug = await uniqueOrgSlug(svc, name)
  const { data, error } = await svc
    .from("organizations")
    .insert({ name, slug, organization_type: "investor", status: "active", country: "France" })
    .select("id, name")
    .single()
  if (error) throw new Error(`Investor "${name}": ${error.message}`)
  return { ...(data as { id: string; name: string }), created: true }
}

/** Links an investor to a round; an existing link only has its lead flag updated. Returns true when newly linked. */
export async function linkInvestor(svc: SupabaseClient, roundId: string, investor: { id: string; name: string }, isLead: boolean): Promise<boolean> {
  const { data: existing } = await svc
    .from("funding_round_investors")
    .select("id, is_lead")
    .eq("funding_round_id", roundId)
    .eq("investor_id", investor.id)
    .maybeSingle()
  if (existing) {
    if (isLead && !existing.is_lead) await svc.from("funding_round_investors").update({ is_lead: true }).eq("id", existing.id)
    return false
  }
  const { error } = await svc
    .from("funding_round_investors")
    .insert({ funding_round_id: roundId, investor_id: investor.id, investor_name: investor.name, is_lead: isLead })
  if (error) throw new Error(`Investor link "${investor.name}": ${error.message}`)
  return true
}

/** Investors per round id, lead investors first. */
export async function loadRoundInvestors(svc: SupabaseClient, roundIds: string[]): Promise<Record<string, InvestorLink[]>> {
  const out: Record<string, InvestorLink[]> = {}
  if (!roundIds.length) return out
  const { data } = await svc
    .from("funding_round_investors")
    .select("funding_round_id, investor_id, investor_name, is_lead, organizations(name)")
    .in("funding_round_id", roundIds)
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const org = (Array.isArray(r.organizations) ? r.organizations[0] : r.organizations) as { name?: string } | null
    const list = (out[r.funding_round_id as string] ??= [])
    list.push({ investor_id: r.investor_id as string, name: org?.name ?? (r.investor_name as string) ?? "Unknown investor", is_lead: !!r.is_lead })
  }
  for (const list of Object.values(out)) list.sort((a, b) => Number(b.is_lead) - Number(a.is_lead) || a.name.localeCompare(b.name))
  return out
}
