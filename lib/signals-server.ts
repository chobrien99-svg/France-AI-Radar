import type { SupabaseClient } from "@supabase/supabase-js"

export type SignalInput = {
  signal_type: string
  signal_date: string | null
  strength: number | null
  title: string
  description: string | null
  source_url: string | null
  source_name: string | null
}

/** Recomputes organizations.signal_count and last_signal_date after a change. */
export async function updateSignalCount(supabase: SupabaseClient, organizationId: string) {
  const { count } = await supabase
    .from("signals")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  const { data: latestSignal } = await supabase
    .from("signals")
    .select("signal_date")
    .eq("organization_id", organizationId)
    .not("signal_date", "is", null)
    .order("signal_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  await supabase
    .from("organizations")
    .update({
      signal_count: count ?? 0,
      last_signal_date: latestSignal?.signal_date ?? null,
    })
    .eq("id", organizationId)
}

/** Adds a signal to a startup and refreshes its counters. */
export async function insertSignal(supabase: SupabaseClient, organizationId: string, signal: SignalInput) {
  const { data, error } = await supabase
    .from("signals")
    .insert({ organization_id: organizationId, ...signal })
    .select("id")
    .single()
  if (error) return { error: error.message }
  await updateSignalCount(supabase, organizationId)
  return { id: data.id as string }
}

/** Parses the admin form's body into a signal row. */
export function signalFromBody(body: Record<string, unknown>): SignalInput {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
  return {
    signal_type: String(body.signal_type ?? ""),
    signal_date: str(body.signal_date),
    strength: body.strength ? Number(body.strength) : null,
    title: String(body.title ?? ""),
    description: str(body.description),
    source_url: str(body.source_url),
    source_name: str(body.source_name),
  }
}
