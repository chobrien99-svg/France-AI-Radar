"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

export type MonitoringState = {
  enabled: boolean
  search_aliases: string[]
  exclude_terms: string[]
  last_checked_at: string | null
} | null

type CheckResult = { itemsSeen: number; itemsAnalyzed: number; candidatesCreated: number; errors: string[] }

const toList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean)

export function MonitoringSettings({ organizationId, state, hasSiren }: { organizationId: string; state: MonitoringState; hasSiren: boolean }) {
  const [enabled, setEnabled] = useState(state?.enabled ?? true)
  const [aliases, setAliases] = useState((state?.search_aliases ?? []).join(", "))
  const [excludes, setExcludes] = useState((state?.exclude_terms ?? []).join(", "))
  const [lastChecked, setLastChecked] = useState(state?.last_checked_at ?? null)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [result, setResult] = useState<CheckResult | null>(null)

  async function save(patch?: { enabled?: boolean }) {
    setSaving(true)
    setMessage(null)
    const res = await fetch(`/api/admin/startups/${organizationId}/monitoring`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: patch?.enabled ?? enabled, search_aliases: toList(aliases), exclude_terms: toList(excludes) }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    setMessage(res.ok ? "Saved." : data.error ?? "Could not save")
  }

  async function checkNow() {
    setChecking(true)
    setMessage(null)
    setResult(null)
    const res = await fetch(`/api/admin/startups/${organizationId}/monitoring`, { method: "POST" })
    const data = await res.json().catch(() => ({}))
    setChecking(false)
    if (!res.ok) return setMessage(data.error ?? "The check failed")
    setResult(data)
    setLastChecked(new Date().toISOString())
  }

  return (
    <div>
      <Separator className="my-6" />
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Signal monitoring</p>
      <p className="mb-4 text-[12px] text-muted-foreground">
        Checked nightly in {hasSiren ? "the official register (BODACC), " : ""}the tech press and Google News. Finds go to{" "}
        <Link href="/admin/signals" className="underline">Signals to review</Link>.
        {!hasSiren && " Add a SIREN under Legal entities to include the official register."}
        {lastChecked && ` Last checked ${new Date(lastChecked).toLocaleString("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`}
      </p>

      <div className="space-y-3 bg-card p-4">
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); save({ enabled: e.target.checked }) }}
          />
          Include this startup in the nightly check
        </label>
        <div>
          <label className="text-[12px] font-medium text-foreground">Other names to search for</label>
          <Input className="text-[13px]" placeholder="e.g. a brand or product name, comma-separated" value={aliases} onChange={(e) => setAliases(e.target.value)} />
        </div>
        <div>
          <label className="text-[12px] font-medium text-foreground">Ignore articles that mention</label>
          <Input className="text-[13px]" placeholder="e.g. words that signal a namesake, comma-separated" value={excludes} onChange={(e) => setExcludes(e.target.value)} />
        </div>
        <div className="flex items-center justify-end gap-2">
          {message && <p className="mr-auto text-[12px] text-muted-foreground">{message}</p>}
          <Button type="button" variant="ghost" size="sm" onClick={() => save()} disabled={saving}>Save names</Button>
          <Button type="button" variant="outline" size="sm" onClick={checkNow} disabled={checking}>
            {checking ? "Checking… (up to a minute)" : "Check now"}
          </Button>
        </div>
        {result && (
          <div className="text-[12px] text-foreground">
            Found {result.itemsSeen} new item{result.itemsSeen === 1 ? "" : "s"}, read {result.itemsAnalyzed},{" "}
            queued {result.candidatesCreated} draft{result.candidatesCreated === 1 ? "" : "s"}
            {result.candidatesCreated > 0 && <> · <Link href="/admin/signals" className="underline">review them</Link></>}.
            {result.errors.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {result.errors.slice(0, 8).map((e, i) => <li key={i} className="break-all">{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
