// Sites allowed to show our embeds (/embed/*). Browsers refuse to display the
// graphic inside a page from any other site (Content-Security-Policy
// frame-ancestors), so copying the iframe code elsewhere shows nothing.
// Extra sites can be added without a code change through EMBED_ALLOWED_ORIGINS
// (comma-separated, e.g. "https://staging.frenchtechjournal.com").
export const EMBED_ALLOWED_ORIGINS = [
  "https://www.frenchtechjournal.com",
  "https://frenchtechjournal.com",
  "https://www.franceairadar.com",
  "https://franceairadar.com",
]

export function embedFrameAncestors(extra = process.env.EMBED_ALLOWED_ORIGINS ?? ""): string {
  const more = extra.split(",").map((s) => s.trim()).filter((s) => /^https?:\/\/[^\s/;,]+$/.test(s))
  return ["'self'", ...new Set([...EMBED_ALLOWED_ORIGINS, ...more])].join(" ")
}
