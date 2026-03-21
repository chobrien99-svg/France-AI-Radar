import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center">
      <p className="mb-1 text-[13px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        404
      </p>
      <h1 className="mb-2 text-[22px] font-bold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mb-6 text-[13px] text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <div className="flex items-center gap-3">
        <Button size="sm" asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/database">Database</Link>
        </Button>
      </div>
    </div>
  )
}
