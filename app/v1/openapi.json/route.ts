// GET /v1/openapi.json: the API contract (OpenAPI 3.1).
import { apiRoute } from "@/lib/api/handler"
import { OPENAPI } from "@/lib/api/openapi"

export const GET = apiRoute(() => OPENAPI)
