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
  title: "France AI Radar",
  description: "Investor intelligence for the French AI ecosystem",
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
