// Startup logo requirements — shared by the admin upload field (client-side
// checks + hint text) and the upload API (server-side checks).

export const LOGO_BUCKET = "logos"
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const
export const LOGO_MAX_BYTES = 1024 * 1024 // 1 MB
export const LOGO_MIN_PX = 256
export const LOGO_IDEAL_PX = 512
/** How far from square an image may be (2%) before it's rejected */
export const LOGO_SQUARE_TOLERANCE = 0.02

export const LOGO_HINT =
  `Square image, at least ${LOGO_MIN_PX}×${LOGO_MIN_PX} px (${LOGO_IDEAL_PX}×${LOGO_IDEAL_PX} px ideal). ` +
  `PNG, JPG or WebP, max 1 MB. A transparent or white background works best. ` +
  `Shown on database cards and the profile header in place of the initials.`

export function isSquareEnough(w: number, h: number): boolean {
  return Math.abs(w - h) / Math.max(w, h) <= LOGO_SQUARE_TOLERANCE
}
