import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import type { EmailOtpType } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const ALLOWED_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]

function isEmailOtpType(value: string | undefined): value is EmailOtpType {
  return !!value && (ALLOWED_TYPES as string[]).includes(value)
}

async function confirmAction(formData: FormData) {
  "use server"
  const token_hash = String(formData.get("token_hash") ?? "")
  const typeRaw = String(formData.get("type") ?? "")
  const next = String(formData.get("next") ?? "/database")

  if (!token_hash || !isEmailOtpType(typeRaw)) {
    redirect("/auth/login?error=Invalid+confirmation+link")
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type: typeRaw as EmailOtpType, token_hash })
  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`)
  }
  redirect(next)
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>
}) {
  const params = await searchParams
  const token_hash = params.token_hash
  const type = params.type
  const next = params.next ?? "/database"

  if (!token_hash || !isEmailOtpType(type)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center bg-destructive/10">
            <span className="text-xl text-destructive">!</span>
          </div>
          <h1 className="mb-2 font-serif text-lg font-semibold text-foreground">
            Link is missing details
          </h1>
          <p className="mb-4 text-sm text-muted-foreground">
            This confirmation link is incomplete. Try requesting a new one.
          </p>
          <a href="/auth/login" className="text-[13px] font-medium text-primary hover:underline">
            Back to sign in →
          </a>
        </div>
      </div>
    )
  }

  const heading =
    type === "recovery"
      ? "Confirm your password reset"
      : type === "invite"
        ? "Accept your invite"
        : type === "magiclink"
          ? "Confirm your sign-in"
          : "Confirm your email"

  const buttonLabel =
    type === "recovery"
      ? "Continue to reset password"
      : type === "invite"
        ? "Accept invite"
        : type === "magiclink"
          ? "Sign in"
          : "Confirm my email"

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center bg-primary text-[13px] font-bold text-primary-foreground"
              style={{ background: "linear-gradient(135deg, #114563 0%, #2f5d7c 100%)" }}
            >
              AR
            </div>
            <span className="font-serif text-sm font-semibold text-foreground">AI Radar</span>
          </div>
        </div>

        <div className="data-card-compact bg-card p-6 text-center">
          <h1 className="mb-2 font-serif text-lg font-semibold text-foreground">{heading}</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Click the button below to finish. This step protects your account from automated email scanners.
          </p>

          <form action={confirmAction}>
            <input type="hidden" name="token_hash" value={token_hash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next} />
            <Button type="submit" className="w-full">
              {buttonLabel}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
