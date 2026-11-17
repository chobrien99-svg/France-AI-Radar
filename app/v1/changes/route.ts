// GET /v1/changes: the change feed for incremental sync, oldest first.
import { apiRoute } from "@/lib/api/handler"
import { parseChangesQuery } from "@/lib/api/changes"
import { listChanges } from "@/lib/api/sync"

export const GET = apiRoute(async (_req, { svc, params }) => {
  const q = parseChangesQuery(params)
  return listChanges(await svc(), q)
})
