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
            Privacy Policy
          </h1>
          <p className="mb-10 text-[14px] text-muted-foreground">
            Last updated: June 2026
          </p>

          <div className="space-y-8 text-[15px] leading-relaxed text-foreground">
            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Data Controller
              </h2>
              <p className="text-muted-foreground">
                The data controller for France AI Radar is:<br />
                <strong className="text-foreground">The French Tech Journal</strong> (SASU)<br />
                61 Rue de Lyon, 75012 Paris, France<br />
                SIREN: 104262696<br />
                Email: chris@frenchtechjournal.com
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                What we collect
              </h2>
              <p className="text-muted-foreground">
                <strong className="text-foreground">Account data:</strong> Email address, full name, and optional profile information
                (title, company, user type) that you provide when creating an account.
              </p>
              <p className="mt-2 text-muted-foreground">
                <strong className="text-foreground">Subscription data:</strong> Subscription tier and status. We do not collect or store
                payment card information — payment processing is handled entirely by Stripe.
              </p>
              <p className="mt-2 text-muted-foreground">
                <strong className="text-foreground">Usage data:</strong> If you consent, we collect product analytics including pageviews,
                button clicks, and session data through PostHog to understand how France AI Radar is used and
                improve the product.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Data processors & sub-processors
              </h2>
              <p className="mb-3 text-muted-foreground">
                We use the following services to operate France AI Radar:
              </p>
              <div className="space-y-3">
                <div className="border-l-2 border-l-border bg-accent p-4">
                  <p className="text-[13px] font-semibold text-foreground">Supabase (Database & Authentication)</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Stores all user accounts, profiles, startup intelligence data, watchlists, and application data.
                    Hosted in the EU. Supabase acts as a data processor.
                  </p>
                </div>
                <div className="border-l-2 border-l-border bg-accent p-4">
                  <p className="text-[13px] font-semibold text-foreground">Vercel (Application Hosting)</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Hosts and serves the France AI Radar web application. Processes HTTP requests but does not
                    store persistent user data.
                  </p>
                </div>
                <div className="border-l-2 border-l-border bg-accent p-4">
                  <p className="text-[13px] font-semibold text-foreground">Stripe (Payment Processing)</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Handles all subscription payments, billing, invoices, and payment method storage.
                    We never see or store your card details.
                  </p>
                </div>
                <div className="border-l-2 border-l-border bg-accent p-4">
                  <p className="text-[13px] font-semibold text-foreground">PostHog (Analytics — consent required)</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Product analytics and session recording. Only activated after explicit user consent via
                    the cookie banner. Hosted in the EU. You can withdraw consent at any time by clearing
                    your browser storage.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Cookies & analytics
              </h2>
              <p className="text-muted-foreground">
                France AI Radar uses essential cookies for authentication (session management, login state).
                These are required for the service to function and cannot be disabled.
              </p>
              <p className="mt-2 text-muted-foreground">
                Analytics cookies (PostHog) are only set after you click &ldquo;Accept&rdquo; on the cookie consent banner.
                No tracking occurs before explicit consent. You can withdraw consent at any time by clearing
                your browser&apos;s local storage for this site.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Data we don&apos;t sell
              </h2>
              <p className="text-muted-foreground">
                We do not sell, rent, or trade user data to third parties. Analytics data is used solely
                to improve France AI Radar.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Data retention
              </h2>
              <p className="text-muted-foreground">
                Account data is retained for the duration of your account. If you delete your account,
                your personal data is removed. Startup intelligence data (which is not personal data)
                is retained as part of our editorial database.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Your rights (GDPR)
              </h2>
              <p className="text-muted-foreground">
                Under the General Data Protection Regulation (GDPR), you have the right to:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                <li>Access your personal data</li>
                <li>Rectify inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to or restrict processing</li>
                <li>Data portability</li>
                <li>Withdraw consent for analytics at any time</li>
              </ul>
              <p className="mt-2 text-muted-foreground">
                To exercise these rights, contact us at{" "}
                <a href="mailto:chris@frenchtechjournal.com" className="text-primary hover:underline">
                  chris@frenchtechjournal.com
                </a>.
                We will respond within 30 days.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Contact
              </h2>
              <p className="text-muted-foreground">
                For any privacy-related questions or requests:<br />
                <a href="mailto:chris@frenchtechjournal.com" className="text-primary hover:underline">
                  chris@frenchtechjournal.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
