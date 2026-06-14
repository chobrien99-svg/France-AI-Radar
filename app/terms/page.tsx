import Link from "next/link"

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="mb-10 text-[14px] text-muted-foreground">
            Last updated: June 2026
          </p>

          <div className="space-y-8 text-[15px] leading-relaxed text-foreground">

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Legal Notice
              </h2>
              <p className="text-muted-foreground">
                The website{" "}
                <a href="https://www.franceairadar.com" className="text-primary hover:underline">
                  www.franceairadar.com
                </a>{" "}
                is published by:
              </p>
              <div className="mt-3 border-l-2 border-l-border bg-accent p-4">
                <p className="text-[13px] text-muted-foreground">
                  <strong className="text-foreground">The French Tech Journal</strong> (SASU)<br />
                  61 Rue de Lyon, 75012 Paris, France<br />
                  SIREN: 104262696<br />
                  VAT: FR57104262696<br />
                  Email: chris@frenchtechjournal.com
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  <strong className="text-foreground">Publication Director:</strong> Christopher O&apos;Brien
                </p>
              </div>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                1. Acceptance of Terms
              </h2>
              <p className="text-muted-foreground">
                By accessing or using France AI Radar, you agree to be bound by these Terms of Service.
                If you do not agree, do not use the service.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                2. Description of Service
              </h2>
              <p className="text-muted-foreground">
                France AI Radar is an investor intelligence platform that provides structured information
                about AI startups in France. The service includes startup profiles, founder analysis,
                signal detection, and related intelligence tools. Content is produced by the editorial
                team of The French Tech Journal.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                3. Subscriptions & Payments
              </h2>
              <p className="text-muted-foreground">
                Access to France AI Radar requires a paid subscription. Subscriptions are billed monthly
                or annually through Stripe. By subscribing, you authorize recurring charges at the
                applicable rate.
              </p>
              <p className="mt-2 text-muted-foreground">
                You may cancel your subscription at any time from your account settings or via the
                Stripe billing portal. Cancellation takes effect at the end of the current billing
                period — no prorated refunds are issued for partial periods.
              </p>
              <p className="mt-2 text-muted-foreground">
                We reserve the right to modify pricing. Existing subscribers will be notified at
                least 30 days in advance of any price changes.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                4. Acceptable Use
              </h2>
              <p className="text-muted-foreground">
                You agree not to:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                <li>Systematically scrape, copy, or redistribute content from France AI Radar</li>
                <li>Share your account credentials with others</li>
                <li>Use the service for any unlawful purpose</li>
                <li>Attempt to circumvent access controls or subscription tiers</li>
                <li>Resell or sublicense access to the platform or its data</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                5. Intellectual Property
              </h2>
              <p className="text-muted-foreground">
                All content on France AI Radar — including startup profiles, investor briefs, signal
                analysis, and editorial commentary — is the intellectual property of The French Tech
                Journal. You may use exported data for your own internal purposes but may not
                republish, redistribute, or create derivative products from it.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                6. Disclaimer
              </h2>
              <p className="text-muted-foreground">
                France AI Radar provides intelligence for informational purposes only. It does not
                constitute investment advice, legal advice, or a recommendation to invest in any
                company. We make reasonable efforts to ensure accuracy but do not guarantee the
                completeness or timeliness of any information. Investment decisions should be made
                based on your own due diligence.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                7. Limitation of Liability
              </h2>
              <p className="text-muted-foreground">
                To the maximum extent permitted by law, The French Tech Journal shall not be liable
                for any indirect, incidental, or consequential damages arising from your use of
                France AI Radar, including but not limited to investment losses based on information
                obtained through the platform.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                8. Account Termination
              </h2>
              <p className="text-muted-foreground">
                We reserve the right to suspend or terminate accounts that violate these terms.
                You may delete your account at any time by contacting us.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                9. Governing Law
              </h2>
              <p className="text-muted-foreground">
                These terms are governed by the laws of France. Any disputes shall be subject to
                the exclusive jurisdiction of the courts of Paris, France.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                10. Changes to Terms
              </h2>
              <p className="text-muted-foreground">
                We may update these terms from time to time. Continued use of the service after
                changes constitutes acceptance. Material changes will be communicated via email
                to registered users.
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Contact
              </h2>
              <p className="text-muted-foreground">
                For questions about these terms, contact us at{" "}
                <a href="mailto:chris@frenchtechjournal.com" className="text-primary hover:underline">
                  chris@frenchtechjournal.com
                </a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
