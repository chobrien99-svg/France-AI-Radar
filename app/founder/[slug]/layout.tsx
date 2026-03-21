import { AppNav } from "@/components/app-nav"

export default function FounderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppNav activePage="database" />
      {children}
    </div>
  )
}
