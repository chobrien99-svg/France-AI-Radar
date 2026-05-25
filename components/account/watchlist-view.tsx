"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { WatchlistRemoveButton } from "@/components/account/watchlist-remove-button"

type WatchlistItem = {
  id: string
  created_at: string
  org: {
    id: string
    name: string
    slug: string
    signal_count: number | null
    last_signal_date: string | null
    city: string | null
    tags: string[]
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "1d ago"
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function WatchlistView({ items }: { items: WatchlistItem[] }) {
  const [view, setView] = useState<"cards" | "table">("cards")

  return (
    <div>
      {items.length > 1 && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            {items.length} startup{items.length !== 1 ? "s" : ""} saved
          </p>
          <div className="flex gap-1">
            <Button
              variant={view === "cards" ? "default" : "ghost"}
              size="sm"
              className="text-[11px]"
              onClick={() => setView("cards")}
            >
              Cards
            </Button>
            <Button
              variant={view === "table" ? "default" : "ghost"}
              size="sm"
              className="text-[11px]"
              onClick={() => setView("table")}
            >
              Table
            </Button>
          </div>
        </div>
      )}

      {view === "cards" ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="data-card flex items-center justify-between gap-4 p-4"
            >
              <div>
                <p className="text-[14px] font-semibold text-foreground">{item.org.name}</p>
                {item.org.city && (
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{item.org.city}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <WatchlistRemoveButton startupId={item.org.id} />
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/startup/${item.org.slug}`}>View →</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden border border-border/40">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Startup</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Location</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Signals</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Last Signal</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Saved</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="bg-background transition-colors hover:bg-secondary/20">
                  <td className="px-4 py-3">
                    <Link
                      href={`/startup/${item.org.slug}`}
                      className="font-semibold text-foreground hover:underline"
                    >
                      {item.org.name}
                    </Link>
                    {item.org.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.org.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="badge-signal badge-signal-neutral text-[9px]">{tag}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.org.city ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.org.signal_count ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatRelative(item.org.last_signal_date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(item.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <WatchlistRemoveButton startupId={item.org.id} />
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/startup/${item.org.slug}`}>View →</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
