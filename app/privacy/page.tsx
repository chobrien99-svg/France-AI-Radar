import Link from "next/link"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="page-container py-16">
        <div className="mx-auto max-w-[720px]">
          <Link
            href="/"
            className="mb-8 inline-flex text-[13px] font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
          >
            ← Back to home
          </Link>

          <h1 className="mb-2 font-serif text-[32px] font-bold tracking-tight text-foreground">
            Privacy
          </h1>
          <p className="mb-10 text-[14px] text-muted-foreground">
            How AI Radar handles data.
          </p>

          <div className="space-y-8 text-[15px] leading-relaxed text-foreground">
            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                What we collect
              </h2>
              <p className="text-muted-foreground">
                Account data you provide: email, full name, subscription tier.
                We do not collect or store payment card information — that is
                handled by Stripe. If you consent, we also collect product
                analytics: pageviews, button clicks, and session data through
                PostHog, to understand how AI Radar is used and improve the
                product.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Cookies & analytics
              </h2>
              <p className="text-muted-foreground">
                AI Radar uses cookies for essential functionality (authentication
                sessions, subscription state) and, if you consent, for analytics
                via PostHog. Analytics cookies are only set after you click
                Accept on the cookie banner. You can withdraw consent at any
                time by clearing your browser storage for this site.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Data we don&apos;t sell
              </h2>
              <p className="text-muted-foreground">
                We do not sell user data to third parties. Analytics data is
                used only to improve AI Radar.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Your rights
              </h2>
              <p className="text-muted-foreground">
                Under GDPR, you have the right to access, correct, or delete
                your personal data. Email us and we will respond within a
                reasonable timeframe.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Contact
              </h2>
              <p className="text-muted-foreground">
                For privacy questions, contact us through the channels listed
                on our pricing page.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
