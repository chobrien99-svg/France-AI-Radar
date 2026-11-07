// GET /v1/taxonomy: the values every filter accepts.
import { apiRoute } from "@/lib/api/handler"
import { rejectUnknown } from "@/lib/api/params"
import { taxonomy } from "@/lib/api/query"

export const GET = apiRoute(async (_req, { dataset, params }) => {
  rejectUnknown(params, [])
  return taxonomy(await dataset(), params)
})
