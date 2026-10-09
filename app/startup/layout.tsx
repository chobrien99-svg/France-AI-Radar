import { AppNav } from "@/components/app-nav"
import { SiteFooter } from "@/components/site-footer"

export default function StartupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppNav activePage="database" />
      {children}
      <SiteFooter />
    </div>
  )
}
