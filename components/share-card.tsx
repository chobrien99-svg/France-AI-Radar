// Share card image (1200×630) rendered by next/og for link previews.
// Plain inline styles only: next/og supports a subset of CSS (flexbox, no grid).
import { titleFit } from "@/lib/share-meta"

const INK = "#0b0e13"
const PAPER = "#f4f4f1"
const BLUE = "#2e6bff"
const MUTED = "#5f656a"

export const SHARE_CARD_SIZE = { width: 1200, height: 630 }

export function ShareCard({ eyebrow, title, description }: { eyebrow?: string | null; title: string; description?: string | null }) {
  const fit = titleFit(title)
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, color: INK, fontFamily: "sans-serif" }}>
      <div style={{ height: 14, background: BLUE, display: "flex" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "56px 72px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, letterSpacing: 4, color: BLUE, fontWeight: 700 }}>
          <div style={{ width: 18, height: 18, background: BLUE, display: "flex" }} />
          FRANCE AI RADAR
        </div>
        {eyebrow ? <div style={{ marginTop: 44, fontSize: 28, color: MUTED, letterSpacing: 1, display: "flex" }}>{eyebrow}</div> : <div style={{ marginTop: 44, display: "flex" }} />}
        <div style={{ marginTop: 12, fontSize: fit.fontSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, display: "flex" }}>{fit.text}</div>
        {description ? (
          <div style={{ marginTop: 28, fontSize: 34, lineHeight: 1.35, color: "#3c4146", display: "flex", maxWidth: 1000 }}>{description}</div>
        ) : null}
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `2px solid ${INK}`, paddingTop: 22, fontSize: 26, color: MUTED }}>
          <div style={{ display: "flex" }}>Investor intelligence for the French AI ecosystem</div>
          <div style={{ display: "flex", color: INK, fontWeight: 700 }}>franceairadar.com</div>
        </div>
      </div>
    </div>
  )
}
