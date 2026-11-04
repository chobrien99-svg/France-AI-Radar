import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { loadCohort } from "@/lib/embed/cohort"
import { cohortEmbed } from "@/lib/embed/editorial"
import { CohortInfographic } from "@/components/embed/cohort-infographic"
import "../../embed.css"

// Read live from the database: editors' changes show on the next load.
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const e = cohortEmbed(slug)
  return {
    title: e ? `${e.title} · France AI Radar` : "France AI Radar",
    // Embeds are shown inside other sites' articles; keep them out of search results.
    robots: { index: false, follow: true },
  }
}

export default async function CohortEmbedPage({ params }: Props) {
  const { slug } = await params
  const editorial = cohortEmbed(slug)
  if (!editorial) notFound()
  const cohort = await loadCohort(await createServiceClient(), slug)
  if (!cohort || cohort.companies.length === 0) notFound()
  return <CohortInfographic slug={slug} editorial={editorial} cohort={cohort} asOf={new Date().toISOString().slice(0, 10)} />
}
