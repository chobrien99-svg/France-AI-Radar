// GET /v1/snapshot: start a full sync; returns the cursor to replay changes from.
import { apiRoute } from "@/lib/api/handler"
import { rejectUnknown } from "@/lib/api/params"
import { snapshotStart } from "@/lib/api/sync"

export const GET = apiRoute(async (_req, { svc, params }) => {
  rejectUnknown(params, [])
  return snapshotStart(await svc())
})
