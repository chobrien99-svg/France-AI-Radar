// French and European tech press feeds read once per monitoring run.
// Each item is matched against every Radar startup's name and aliases
// (lib/monitoring/match.ts). A feed that fails is skipped and listed in
// the run log (monitoring_runs.errors), so a moved URL shows up there;
// edit this list to add, fix or drop a feed.
// Left out on purpose: Les Echos (refuses automated readers, HTTP 403) and
// FrenchWeb (no feed any more, HTTP 404). Google News still finds both.
export const PRESS_FEEDS: { name: string; url: string }[] = [
  { name: "French Tech Journal", url: "https://www.frenchtechjournal.com/latest/rss/" },
  { name: "Maddyness", url: "https://www.maddyness.com/feed/" },
  { name: "Siècle Digital", url: "https://siecledigital.fr/feed/" },
  { name: "ActuIA", url: "https://www.actuia.com/feed/" },
  { name: "L'Usine Digitale", url: "https://www.usine-digitale.fr/rss" },
  { name: "BFM Tech & Co", url: "https://www.bfmtv.com/rss/tech/" },
  { name: "Sifted", url: "https://sifted.eu/feed" },
  { name: "EU-Startups", url: "https://www.eu-startups.com/feed/" },
  { name: "Tech.eu", url: "https://tech.eu/feed/" },
]
