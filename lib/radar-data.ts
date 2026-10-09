import type { SupabaseClient } from "@supabase/supabase-js"
import type { CardStartup } from "@/components/radar/cards"
import { stageFrom } from "@/lib/radar"

type Row = Record<string, unknown>
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] : v) ?? null

/**
 * Up to `count` other AI Radar startups for the "More on the Radar" strip,
 * same city first, then most recently active.
 */
export async function loadRelatedStartups(
  svc: SupabaseClient,
  excludeId: string,
  cityId: string | null,
  count = 3
): Promise<CardStartup[]> {
  const { data: radar } = await svc
    .from("product_organizations")
    .select("organization_id, product_catalog!inner(slug)")
    .eq("product_catalog.slug", "ai-radar")
  const ids = ((radar ?? []) as Row[]).map((r) => r.organization_id as string).filter((id) => id !== excludeId)
  if (ids.length === 0) return []

  const { data: orgs } = await svc
    .from("organizations")
    .select("id, name, slug, description, short_description, logo_url, last_round, signal_count, last_signal_date, city_id, cities!organizations_city_id_fkey(id, name)")
    .in("id", ids)
    .eq("status", "active")
    .order("last_signal_date", { ascending: false, nullsFirst: false })
    .limit(24)

  const picked = ((orgs ?? []) as Row[])
    .sort((a, b) => Number(b.city_id === cityId && !!cityId) - Number(a.city_id === cityId && !!cityId))
    .slice(0, count)
  const pickedIds = picked.map((o) => o.id as string)
  if (pickedIds.length === 0) return []

  const [{ data: sectors }, { data: signals }] = await Promise.all([
    svc.from("organization_sectors").select("organization_id, is_primary, sectors(name)").in("organization_id", pickedIds),
    svc
      .from("signals")
      .select("organization_id, signal_type, title, signal_date")
      .in("organization_id", pickedIds)
      .order("signal_date", { ascending: false, nullsFirst: false }),
  ])

  const sectorBy = new Map<string, string>()
  for (const r of (sectors ?? []) as Row[]) {
    const s = one(r.sectors as { name: string } | { name: string }[] | null)
    if (s && (!sectorBy.has(r.organization_id as string) || r.is_primary)) sectorBy.set(r.organization_id as string, s.name)
  }
  const latestBy = new Map<string, CardStartup["latestSignal"]>()
  for (const r of (signals ?? []) as Row[]) {
    if (!latestBy.has(r.organization_id as string)) {
      latestBy.set(r.organization_id as string, { type: r.signal_type as string, title: r.title as string, date: (r.signal_date as string | null) ?? null })
    }
  }

  return picked.map((o) => ({
    id: o.id as string,
    slug: o.slug as string,
    name: o.name as string,
    description: (o.short_description as string | null) || (o.description as string | null),
    logoUrl: (o.logo_url as string | null) ?? null,
    sector: sectorBy.get(o.id as string) ?? null,
    stage: stageFrom(o.last_round as string | null),
    city: one(o.cities as { name: string } | { name: string }[] | null)?.name ?? null,
    signalCount: (o.signal_count as number | null) ?? 0,
    latestSignal: latestBy.get(o.id as string) ?? null,
  }))
}
