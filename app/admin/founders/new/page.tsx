import { requireAdmin } from "@/lib/admin"
import { FounderForm } from "@/components/admin/founder-form"

export default async function NewFounderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const params = await searchParams
  const linkTo = (Array.isArray(params.link_to) ? params.link_to[0] : params.link_to) ?? undefined

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin › Founders</p>
        <h1 className="mt-0.5 font-serif text-[24px] font-bold text-foreground">Add New Founder</h1>
        {linkTo && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            This person will be automatically linked to the startup after creation.
          </p>
        )}
      </div>
      <FounderForm linkToOrganizationId={linkTo} />
    </div>
  )
}
