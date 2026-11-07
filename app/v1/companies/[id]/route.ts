// GET /v1/companies/{id}: one published company by id or slug.
import { apiRoute } from "@/lib/api/handler"
import { rejectUnknown } from "@/lib/api/params"
import { getCompany } from "@/lib/api/query"

export const GET = apiRoute(async (req, { dataset, params }) => {
  rejectUnknown(params, [])
  const id = decodeURIComponent(new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "")
  return getCompany(await dataset(), id)
})
