import { requireAdmin } from "@/lib/admin"
import { StartupForm } from "@/components/admin/startup-form"

export default async function NewStartupPage() {
  await requireAdmin()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin › Startups</p>
        <h1 className="mt-0.5 text-[24px] font-bold text-foreground">Add New Startup</h1>
      </div>
      <StartupForm />
    </div>
  )
}
