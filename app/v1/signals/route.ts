// GET /v1/signals: approved signals on published companies, newest first.
import { apiRoute } from "@/lib/api/handler"
import { prepareListSignals } from "@/lib/api/query"

export const GET = apiRoute(async (_req, { dataset, params }) => {
  const run = prepareListSignals(params)
  return run(await dataset())
})
