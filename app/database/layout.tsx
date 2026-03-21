import { Suspense } from "react"
import { AppNav } from "@/components/app-nav"
import { CheckoutSuccessBanner } from "@/components/checkout-success-banner"

export default function DatabaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppNav activePage="database" />
      <Suspense>
        <CheckoutSuccessBanner />
      </Suspense>
      {children}
    </div>
  )
}
