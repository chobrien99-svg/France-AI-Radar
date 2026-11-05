import type { Metadata } from "next"
import { Newsreader } from "next/font/google"
import { Public_Sans, IBM_Plex_Mono } from "next/font/google"
import { CookieConsent } from "@/components/cookie-consent"
import "./globals.css"

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
})

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
})

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
})

export const metadata: Metadata = {
  // Lets share cards and canonical links use relative paths.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.franceairadar.com"),
  title: "France AI Radar",
  description: "Investor intelligence for the French AI ecosystem",
  openGraph: {
    siteName: "France AI Radar",
    type: "website",
    title: "France AI Radar",
    description: "Investor intelligence for the French AI ecosystem",
  },
  twitter: { card: "summary_large_image" },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${newsreader.variable} ${publicSans.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  )
}
