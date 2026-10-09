import { Skeleton } from "@/components/ui/skeleton"

export default function StartupLoading() {
  return (
    <div>
      <div className="r2-hero">
        <div className="page-container r2-hero-in" style={{ paddingBottom: 40 }}>
          <div className="r2-ph">
            <div className="r2-mono xl dark" />
            <div className="space-y-4 pt-2">
              <Skeleton className="h-3 w-48 bg-white/10" />
              <Skeleton className="h-12 w-80 bg-white/10" />
              <Skeleton className="h-4 w-full max-w-[560px] bg-white/10" />
            </div>
          </div>
        </div>
      </div>
      <div className="page-container r2-pbody">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-[5px]" />
          <Skeleton className="h-32 w-full rounded-[5px]" />
        </div>
      </div>
    </div>
  )
}
