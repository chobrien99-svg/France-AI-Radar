import { Suspense } from "react"
import Link from "next/link"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
              AR
            </div>
            <span className="text-sm font-semibold text-foreground">AI Radar</span>
          </Link>
        </div>

        <Suspense fallback={<div className="data-card-compact p-6 h-64 animate-pulse bg-muted rounded-xl" />}>
          <LoginForm />
        </Suspense>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/auth/signup" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
