import { FRANCE_RINGS, CITY_COORDS, project } from "@/lib/france-geo"

const path = (ring: [number, number][]) =>
  "M" + ring.map((p) => project(p).map((v) => v.toFixed(1)).join(",")).join("L") + "Z"

/**
 * France outline with pulsing markers for the cities where Radar startups are based.
 * `cities` is ordered by number of startups; nearby cities are dropped so labels don't collide.
 */
export function FranceMap({ cities }: { cities: string[] }) {
  const placed: { name: string; x: number; y: number }[] = []
  for (const name of cities) {
    const c = CITY_COORDS[name]
    if (!c) continue
    const [x, y] = project(c)
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 45)) continue
    placed.push({ name, x, y })
    if (placed.length === 8) break
  }
  return (
    <svg className="lp-fr" viewBox="-20 -20 1050 1040" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {FRANCE_RINGS.map((r, i) => <path key={i} d={path(r)} />)}
      {placed.map((c, i) => (
        <g key={c.name} className="city">
          <circle className="p" cx={c.x} cy={c.y} r="9" style={{ animationDelay: `${i * 0.8}s` }} />
          <circle className="c" cx={c.x} cy={c.y} r="3.5" />
          <text x={c.x + 14} y={c.y + 5} fontSize="15">{c.name.toUpperCase()}</text>
        </g>
      ))}
    </svg>
  )
}
