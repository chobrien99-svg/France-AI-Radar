import type { Metadata } from "next"
import { Newsreader } from "next/font/google"
import { Public_Sans } from "next/font/google"
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

export const metadata: Metadata = {
  title: "France AI Radar",
  description: "Investor intelligence for the French AI ecosystem",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${newsreader.variable} ${publicSans.variable}`}>
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  )
}
