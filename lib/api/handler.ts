// Shared wrapper for every /v1 route: feature switch, API-key check,
// request id, JSON errors, no caching, and a log line without secrets.
import { randomUUID } from "node:crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { ApiError } from "@/lib/api/errors"
import { authenticate, bearerToken, parseKeyConfig } from "@/lib/api/keys"
import { loadDataset } from "@/lib/api/load"
import type { Dataset } from "@/lib/api/model"

export const API_VERSION = "1.0.0-pilot"

// Per-key request budget. Counted per server instance, so it is a safety net
// against runaway scripts, not exact metering (that arrives with Stage 3).
const RATE_LIMIT_PER_MINUTE = 120
const windows = new Map<string, { start: number; count: number }>()
function overLimit(label: string, now = Date.now()): number | null {
  const w = windows.get(label)
  if (!w || now - w.start >= 60_000) {
    windows.set(label, { start: now, count: 1 })
    return null
  }
  w.count += 1
  return w.count > RATE_LIMIT_PER_MINUTE ? Math.ceil((w.start + 60_000 - now) / 1000) : null
}

type Ctx = { dataset: () => Promise<Dataset>; params: URLSearchParams; keyLabel: string }

function json(body: unknown, status: number, requestId: string, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      "X-API-Version": API_VERSION,
      ...extra,
    },
  })
}

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message, request_id: requestId } }
}

export function apiRoute(handler: (req: Request, ctx: Ctx) => Promise<unknown> | unknown) {
  return async (req: Request): Promise<Response> => {
    const requestId = randomUUID()
    const started = Date.now()
    const keys = parseKeyConfig(process.env.ENTERPRISE_API_KEYS)
    // Switched off until at least one key is configured: answer like a missing page.
    if (keys.length === 0) return new Response("Not Found", { status: 404 })

    let status = 200
    let keyLabel = "-"
    try {
      const label = authenticate(bearerToken(req.headers.get("authorization")), keys)
      if (!label) throw new ApiError("unauthorized", "Send a valid API key as: Authorization: Bearer far_live_…")
      keyLabel = label
      const wait = overLimit(label)
      if (wait != null) {
        status = 429
        return json(errorBody("rate_limited", `More than ${RATE_LIMIT_PER_MINUTE} requests in a minute. Retry after ${wait} seconds.`, requestId), 429, requestId, { "Retry-After": String(wait) })
      }
      const params = new URL(req.url).searchParams
      const dataset = async () => loadDataset(await createServiceClient())
      const body = await handler(req, { dataset, params, keyLabel })
      return json(body, 200, requestId)
    } catch (e) {
      if (e instanceof ApiError) {
        status = e.status
        return json(errorBody(e.code, e.message, requestId), e.status, requestId, e.code === "unauthorized" ? { "WWW-Authenticate": 'Bearer realm="france-ai-radar"' } : {})
      }
      status = 500
      console.error(`[api] ${requestId} internal error:`, e instanceof Error ? e.message : e)
      return json(errorBody("internal", "Something went wrong on our side. Retry later and quote the request id if it persists.", requestId), 500, requestId)
    } finally {
      console.log(`[api] ${requestId} key=${keyLabel} ${req.method} ${new URL(req.url).pathname} ${status} ${Date.now() - started}ms`)
    }
  }
}
