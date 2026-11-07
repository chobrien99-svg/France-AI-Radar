// GET /v1/companies: published Radar companies, filtered and paginated.
import { apiRoute } from "@/lib/api/handler"
import { prepareListCompanies } from "@/lib/api/query"

export const GET = apiRoute(async (_req, { dataset, params }) => {
  const run = prepareListCompanies(params)
  return run(await dataset())
})
