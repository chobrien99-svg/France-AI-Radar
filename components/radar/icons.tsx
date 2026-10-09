// Line icons from the v2 design (16×16 grid, 1.4 stroke)

export type IconName = "star" | "star-on" | "grid" | "list" | "search" | "back" | "arrow" | "bell" | "bell-on" | "down" | "share" | "external"

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }
  const star = "m8 1.8 1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"
  switch (name) {
    case "star": return <svg {...p}><path d={star} /></svg>
    case "star-on": return <svg {...p} fill="currentColor"><path d={star} /></svg>
    case "grid": return <svg {...p} fill="currentColor" stroke="none"><rect x="2" y="2" width="5" height="5" /><rect x="9" y="2" width="5" height="5" /><rect x="2" y="9" width="5" height="5" /><rect x="9" y="9" width="5" height="5" /></svg>
    case "list": return <svg {...p}><path d="M2 4h12M2 8h12M2 12h12" /></svg>
    case "search": return <svg {...p}><circle cx="7" cy="7" r="4.8" /><path d="m13.5 13.5-3-3" /></svg>
    case "back": return <svg {...p}><path d="M13 8H3M7 4 3 8l4 4" /></svg>
    case "arrow": return <svg {...p}><path d="M3 8h10M9 4l4 4-4 4" /></svg>
    case "bell": return <svg {...p}><path d="M4 11.5V7a4 4 0 0 1 8 0v4.5M2.8 11.5h10.4M6.8 14h2.4" /></svg>
    case "bell-on": return <svg {...p}><path d="M4 11.5V7a4 4 0 0 1 8 0v4.5z" fill="currentColor" /><path d="M2.8 11.5h10.4M6.8 14h2.4" /></svg>
    case "down": return <svg {...p}><path d="M8 2.5v9M4 8l4 4 4-4M3 14h10" /></svg>
    case "share": return <svg {...p}><circle cx="12" cy="3.5" r="1.8" /><circle cx="4" cy="8" r="1.8" /><circle cx="12" cy="12.5" r="1.8" /><path d="m5.6 7.1 4.8-2.7M5.6 8.9l4.8 2.7" /></svg>
    case "external": return <svg {...p}><path d="M10 2h4v4M14 2 8 8M12 9v4H3V4h4" /></svg>
  }
}
