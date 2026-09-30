import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { ResetPasswordForm } from "./reset-password-form"

export const dynamic = "force-dynamic"

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center bg-primary text-[13px] font-bold text-primary-foreground" style={{ background: 'linear-gradient(135deg, #114563 0%, #2f5d7c 100%)' }}>
              AR
            </div>
            <span className="font-serif text-sm font-semibold text-foreground">AI Radar</span>
          </Link>
        </div>

        {user ? (
          <ResetPasswordForm email={user.email ?? ""} />
        ) : (
          <div className="data-card-compact bg-card p-6 text-center">
            <h1 className="mb-2 font-serif text-lg font-semibold text-foreground">Reset link expired</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              This password reset link is no longer valid. Request a new one from the sign-in page.
            </p>
            <Link href="/auth/login" className="text-[13px] font-medium text-primary hover:underline">
              Back to sign in →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
