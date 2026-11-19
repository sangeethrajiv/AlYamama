import type { NextFunction, Request, Response } from 'express'

/** Error with an HTTP status, raised by services and turned into the standard JSON error response. */
export class AppError extends Error {
  constructor(message: string, public status = 400, public code = 'validation_error') {
    super(message)
  }
}
export const notFound = (what: string) => new AppError(`${what} not found`, 404, 'not_found')

export const ok = (res: Response, data: unknown, message?: string, status = 200) =>
  res.status(status).json(message ? { success: true, data, message } : { success: true, data })

export const fail = (res: Response, status: number, message: string, code?: string) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) })

/** Wraps an async controller so thrown errors reach the error middleware (Express 5 also does this; kept explicit). */
export const handle =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next)

/** Escapes % _ \ for use inside an ILIKE pattern. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, m => '\\' + m)

export const toInt = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  return Number.isInteger(n) ? n : undefined
}

export const paging = (q: Record<string, unknown>, defLimit = 80, maxLimit = 500) => {
  const limit = Math.min(Math.max(toInt(q.limit) ?? defLimit, 1), maxLimit)
  const page = Math.max(toInt(q.page) ?? 1, 1)
  return { limit, offset: (page - 1) * limit, page }
}

/** Strips undefined values from an object. */
export const clean = <T extends Record<string, unknown>>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
