import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function StartupNotFound() {
  return (
    <main className="page-container py-24 text-center">
      <p className="mb-1 text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        404
      </p>
      <h1 className="mb-2 text-[22px] font-bold tracking-tight text-foreground">
        Startup not found
      </h1>
      <p className="mb-6 text-[13px] text-muted-foreground">
        This startup may have been removed or the URL is incorrect.
      </p>
      <Button size="sm" asChild>
        <Link href="/database">← Back to Database</Link>
      </Button>
    </main>
  )
}
