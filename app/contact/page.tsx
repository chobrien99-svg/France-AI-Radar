import Link from "next/link"

export default function ContactPage() {
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
            Contact
          </h1>
          <p className="mb-10 text-[14px] text-muted-foreground">
            Get in touch with the France AI Radar team.
          </p>

          <div className="space-y-8 text-[15px] leading-relaxed text-foreground">

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                General Inquiries
              </h2>
              <p className="text-muted-foreground">
                For questions about France AI Radar, partnerships, or media inquiries:
              </p>
              <p className="mt-2">
                <a href="mailto:chris@frenchtechjournal.com" className="text-primary hover:underline">
                  chris@frenchtechjournal.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Enterprise & Team Access
              </h2>
              <p className="text-muted-foreground">
                For enterprise subscriptions, team access, API partnerships, or custom intelligence
                packages, contact us directly:
              </p>
              <p className="mt-2">
                <a href="mailto:chris@frenchtechjournal.com" className="text-primary hover:underline">
                  chris@frenchtechjournal.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Account & Billing Support
              </h2>
              <p className="text-muted-foreground">
                For subscription, billing, or account issues, you can manage most settings from
                your{" "}
                <Link href="/account" className="text-primary hover:underline">
                  account page
                </Link>
                . For anything else, email us and we&apos;ll respond promptly.
              </p>
            </section>

            <section>
              <h2 className="mb-4 font-serif text-[18px] font-semibold text-foreground">
                About
              </h2>
              <p className="text-muted-foreground">
                The France AI Radar is produced by{" "}
                <strong className="text-foreground">The French Tech Journal</strong>.
              </p>
              <div className="mt-4 space-y-3">
                <div className="border-l-2 border-l-primary bg-accent p-4">
                  <p className="text-[14px] font-semibold text-foreground">Chris O&apos;Brien</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Founder and Editor of The French Tech Journal
                  </p>
                </div>
                <div className="border-l-2 border-l-primary bg-accent p-4">
                  <p className="text-[14px] font-semibold text-foreground">Helen O&apos;Reilly-Durand</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Co-Founder and Deputy Editor
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-foreground">
                Publisher
              </h2>
              <div className="border-l-2 border-l-border bg-accent p-4">
                <p className="text-[13px] text-muted-foreground">
                  <strong className="text-foreground">The French Tech Journal</strong> (SASU)<br />
                  61 Rue de Lyon, 75012 Paris, France<br />
                  SIREN: 104262696<br />
                  VAT: FR57104262696<br />
                  Publication Director: Christopher O&apos;Brien
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
