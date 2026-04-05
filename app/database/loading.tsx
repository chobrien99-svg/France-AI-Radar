import { Skeleton } from "@/components/ui/skeleton"

export default function DatabaseLoading() {
  return (
    <div className="page-container">
      <div className="grid gap-6 py-6 pb-16 lg:grid-cols-[260px_1fr]">
        {/* Sidebar skeleton */}
        <div className="hidden space-y-3 p-1 lg:block">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-36" />
          <div className="pt-2 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>

        {/* Main content skeleton */}
        <div>
          {/* Toolbar */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <Skeleton className="h-9 max-w-[400px] flex-1" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>

          {/* Card grid */}
          <div
            className="grid gap-[14px]"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-l-2 border-l-primary bg-card p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                  <Skeleton className="h-5 w-14 shrink-0" />
                </div>
                <div className="mb-3 flex gap-1.5">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="mb-1.5 h-3 w-full" />
                <Skeleton className="mb-1.5 h-3 w-4/5" />
                <div className="mt-3 border-t border-border pt-3">
                  <Skeleton className="h-3 w-2/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
