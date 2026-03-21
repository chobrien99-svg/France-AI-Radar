import { requireAdmin } from "@/lib/admin"
import { FounderForm } from "@/components/admin/founder-form"

export default async function NewFounderPage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin › Founders</p>
        <h1 className="mt-0.5 text-[24px] font-bold text-foreground">Add New Founder</h1>
      </div>
      <FounderForm />
    </div>
  )
}
