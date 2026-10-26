import { requireAdmin } from "@/lib/admin"
import { StartupImport } from "@/components/admin/startup-import"

export default async function ImportStartupPage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin › Startups</p>
        <h1 className="mt-0.5 text-[24px] font-bold text-foreground">Import from a Claude draft</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Paste the draft that the France AI Radar Claude Project produced from a startup&apos;s documents. Check it, review the
          preview, then create it. The startup is saved as a Draft, never published directly.
        </p>
      </div>
      <StartupImport />
    </div>
  )
}
