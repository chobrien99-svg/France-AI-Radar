// What a shared link shows (title, description, share card) for a startup page.
// Only fields every visitor already sees on the page: name, sector, city and the
// one-line description. Companies not on the Radar get the generic site preview.
import type { SupabaseClient } from "@supabase/supabase-js"

export const SITE_NAME = "France AI Radar"
export const SITE_TAGLINE = "Investor intelligence for the French AI ecosystem"

export type StartupShare = { name: string; slug: string; description: string | null; sector: string | null; place: string | null }

/** Collapses whitespace and cuts at a word boundary, adding "…" when shortened. */
export function shareText(text: string | null | undefined, max = 200): string | null {
  const t = (text ?? "").replace(/\s+/g, " ").trim()
  if (!t) return null
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, "") + "…"
}

/** Description for the preview: the company's own line, or a neutral sentence built from public facts. */
export function shareDescription(s: StartupShare): string {
  const own = shareText(s.description)
  if (own) return own
  const what = [s.sector ? `${s.sector} startup` : "AI startup", s.place ? `based in ${s.place}` : null].filter(Boolean).join(" ")
  return `${s.name}: ${what}, tracked by ${SITE_NAME}.`
}

/** Public facts for a startup's share preview, or null when it isn't a public Radar profile. */
export async function loadStartupShare(svc: SupabaseClient, slug: string): Promise<StartupShare | null> {
  const { data: org } = await svc
    .from("organizations")
    .select("id, name, slug, description, short_description, cities!organizations_city_id_fkey(name)")
    .eq("slug", slug)
    .eq("organization_type", "startup")
    .eq("status", "active")
    .maybeSingle()
  if (!org) return null
  const [{ data: radar }, { data: sectors }] = await Promise.all([
    svc.from("product_organizations").select("organization_id, product_catalog!inner(slug)").eq("product_catalog.slug", "ai-radar").eq("organization_id", org.id).limit(1),
    svc.from("organization_sectors").select("is_primary, sectors(name)").eq("organization_id", org.id),
  ])
  if (!radar?.length) return null
  type Row = Record<string, unknown>
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] : v) ?? null
  const sectorRows = ((sectors ?? []) as Row[]).sort((a, b) => Number(!!b.is_primary) - Number(!!a.is_primary))
  const sector = (one(sectorRows[0]?.sectors as Row | Row[] | null)?.name as string) ?? null
  const city = (one((org as Row).cities as Row | Row[] | null)?.name as string) ?? null
  return {
    name: org.name as string,
    slug: org.slug as string,
    description: (org.description as string | null) ?? (org.short_description as string | null),
    sector,
    place: city,
  }
}
