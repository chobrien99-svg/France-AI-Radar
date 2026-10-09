import { Skeleton } from "@/components/ui/skeleton"

export default function DatabaseLoading() {
  return (
    <div>
      <div className="r2-hero">
        <div className="page-container r2-hero-in">
          <div className="r2-eyebrow"><span className="bk" />The Radar · Database</div>
          <h1 className="r2-h1">The Database</h1>
          <div className="r2-stats">
            {["Startups", "Founders", "Sectors", "Signals logged"].map((l) => (
              <div key={l} className="r2-stat"><b>—</b><span>{l}</span></div>
            ))}
          </div>
          <div className="r2-tabs"><span className="r2-tab">Startups</span><span className="r2-tab">Founders</span></div>
        </div>
      </div>
      <div className="page-container r2-body">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
        </div>
        <div>
          <Skeleton className="mb-4 h-[50px] w-full rounded-[5px]" />
          <div className="r2-grid">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[232px] rounded-[5px]" />)}
          </div>
        </div>
      </div>
    </div>
  )
}
