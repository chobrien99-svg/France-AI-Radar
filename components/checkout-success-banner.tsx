"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

export function CheckoutSuccessBanner() {
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      setVisible(true)
      // Auto-dismiss after 8 seconds
      const t = setTimeout(() => setVisible(false), 8000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  if (!visible) return null

  return (
    <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="page-container flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-[13px] text-emerald-800">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-[11px] font-bold">
            ✓
          </span>
          <span>
            <strong className="font-semibold">Subscription activated.</strong>{" "}
            Welcome to AI Radar — your full access is ready.
          </span>
        </div>
        <button
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
          className="shrink-0 text-emerald-600 transition-colors hover:text-emerald-900"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
