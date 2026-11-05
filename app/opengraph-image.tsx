import { ImageResponse } from "next/og"
import { ShareCard, SHARE_CARD_SIZE } from "@/components/share-card"

// Default share card for every page that doesn't have its own.
export const alt = "France AI Radar"
export const size = SHARE_CARD_SIZE
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    <ShareCard title="France AI Radar" description="Early signals on French AI startups: funding, founders, technology." />,
    size,
  )
}
