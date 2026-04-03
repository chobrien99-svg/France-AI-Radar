import { notFound } from "next/navigation"
import Link from "next/link"
import { requireAdmin } from "@/lib/admin"
import { createServiceClient } from "@/lib/supabase/server"
import { FounderForm, type FounderFormValues } from "@/components/admin/founder-form"
import { Button } from "@/components/ui/button"
import { DeleteFounderButton } from "@/components/admin/delete-founder-button"

export default async function EditFounderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const supabase = await createServiceClient()

  const { data: founder } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .single()

  if (!founder) notFound()

  const initialValues: Partial<FounderFormValues> = {
    full_name: founder.full_name ?? "",
    slug: founder.slug ?? "",
    role: founder.role ?? "",
    bio: founder.bio ?? "",
    linkedin_url: founder.linkedin_url ?? "",
    big_tech_employer: founder.big_tech_employer ?? "",
    academic_lab: founder.academic_lab ?? "",
    has_phd: founder.has_phd ?? false,
    is_repeat_founder: founder.is_repeat_founder ?? false,
    has_big_tech_background: founder.has_big_tech_background ?? false,
    previous_exits: String(founder.previous_exits ?? 0),
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Admin › Founders
          </p>
          <h1 className="mt-0.5 text-[24px] font-bold text-foreground">{founder.full_name}</h1>
          {founder.slug && (
            <div className="mt-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/founder/${founder.slug}`} target="_blank">View profile →</Link>
              </Button>
            </div>
          )}
        </div>
        <DeleteFounderButton founderId={id} founderName={founder.full_name} />
      </div>

      <FounderForm initialValues={initialValues} founderId={id} />
    </div>
  )
}
