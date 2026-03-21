import { Skeleton } from "@/components/ui/skeleton"

export default function StartupProfileLoading() {
  return (
    <main className="page-container py-8 pb-20">
      <div className="mx-auto max-w-[960px]">
        {/* Back link */}
        <Skeleton className="mb-6 h-4 w-32" />

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2.5 flex-1">
            <Skeleton className="h-7 w-2/5" />
            <Skeleton className="h-4 w-3/5" />
            <div className="flex gap-1.5 pt-1">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>

        <Skeleton className="mb-8 h-px w-full" />

        {/* Description */}
        <Skeleton className="mb-8 h-4 w-full" />

        {/* Section blocks */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-10">
            <Skeleton className="mb-4 h-3 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
