import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-white/9 bg-ink py-5">
      <div className="page-container flex flex-col items-center justify-between gap-2 text-[12px] text-tx-dm md:flex-row">
        <span className="font-mono text-[11px] tracking-[0.04em]">
          AI RADAR · A PUBLICATION OF FRENCH TECH JOURNAL
        </span>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="transition-colors duration-200 hover:text-tx-d">Privacy</Link>
          <Link href="/terms" className="transition-colors duration-200 hover:text-tx-d">Terms</Link>
          <Link href="/contact" className="transition-colors duration-200 hover:text-tx-d">Contact</Link>
          <span className="font-mono">© 2026</span>
        </div>
      </div>
    </footer>
  )
}
