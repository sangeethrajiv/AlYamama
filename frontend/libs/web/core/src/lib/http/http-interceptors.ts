import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { RequestContext, ApiError } from '@erp/web/api-client';
import type { ProblemDetails } from '@erp/shared/contracts';
import { catchError, throwError } from 'rxjs';

/** Adds the active company and a correlation id to every API call. Inert while the mock adapters are in use. */
export const requestContextInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  const ctx = inject(RequestContext);
  return next(req.clone({ setHeaders: { 'X-Company-Id': ctx.companyId(), 'X-Correlation-Id': crypto.randomUUID() } }));
};

/** Maps RFC 9457 Problem Details error bodies onto ApiError (appendix A.6). The Express backend's `{success:false}` envelope is left to BackendHttp. */
export const problemDetailsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object' && 'code' in err.error && !('success' in err.error)) {
        return throwError(() => new ApiError(err.error as ProblemDetails));
      }
      return throwError(() => err);
    }),
  );
