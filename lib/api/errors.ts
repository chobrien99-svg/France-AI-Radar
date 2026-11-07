// Error codes for the Enterprise API (/v1). Kept free of Next.js imports so
// `npm test` can load it with plain Node.

export const ERROR_STATUS = {
  invalid_parameter: 400,
  unauthorized: 401,
  forbidden_scope: 403,
  not_found: 404,
  gone: 410,
  rate_limited: 429,
  internal: 500,
} as const

export type ErrorCode = keyof typeof ERROR_STATUS

export class ApiError extends Error {
  code: ErrorCode
  status: number
  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
    this.status = ERROR_STATUS[code]
  }
}

export const invalid = (message: string) => new ApiError("invalid_parameter", message)
