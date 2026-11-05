import { ImageResponse } from "next/og"
import { createServiceClient } from "@/lib/supabase/server"
import { loadStartupShare, shareText } from "@/lib/share-meta"
import { ShareCard, SHARE_CARD_SIZE } from "@/components/share-card"

export const alt = "Startup profile on France AI Radar"
export const size = SHARE_CARD_SIZE
export const contentType = "image/png"

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const s = await loadStartupShare(await createServiceClient(), slug).catch(() => null)
  return new ImageResponse(
    s
      ? <ShareCard eyebrow={[s.sector, s.place].filter(Boolean).join(" · ") || "AI startup"} title={s.name} description={shareText(s.description, 150)} />
      : <ShareCard title="France AI Radar" description="Early signals on French AI startups: funding, founders, technology." />,
    size,
  )
}
