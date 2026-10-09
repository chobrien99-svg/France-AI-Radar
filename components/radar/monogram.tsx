import { initials, type Tone } from "@/lib/radar"

/** Square (or round) tile: the logo/photo when we have one, otherwise initials */
export function Monogram({
  name,
  tone = "dark",
  size,
  round = false,
  imageUrl,
}: {
  name: string
  tone?: Tone
  size?: "sm" | "xl"
  round?: boolean
  imageUrl?: string | null
}) {
  const cls = ["r2-mono", imageUrl ? "img" : tone, size, round && "round"].filter(Boolean).join(" ")
  return (
    <div className={cls} aria-hidden="true">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos come from arbitrary hosts
        <img src={imageUrl} alt="" />
      ) : (
        initials(name)
      )}
    </div>
  )
}
