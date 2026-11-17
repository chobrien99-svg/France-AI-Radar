// GET /v1/signals/{id}: one approved signal on a published company.
import { apiRoute } from "@/lib/api/handler"
import { rejectUnknown } from "@/lib/api/params"
import { getSignal } from "@/lib/api/query"

export const GET = apiRoute(async (req, { dataset, params }) => {
  rejectUnknown(params, [])
  const id = decodeURIComponent(new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "")
  return getSignal(await dataset(), id)
})
