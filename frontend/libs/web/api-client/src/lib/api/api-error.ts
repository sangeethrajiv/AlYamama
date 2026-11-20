import type { ProblemDetails } from '@erp/shared/contracts';

/** Error carrying RFC 9457 Problem Details (section 9). Business rule refusals are HTTP 422. */
export class ApiError extends Error {
  constructor(public readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }

  static businessRule(code: string, title: string, detail?: string): ApiError {
    return new ApiError({ type: 'https://erp.example/errors/business-rule', title, status: 422, code, detail });
  }
  static notFound(what: string): ApiError {
    return new ApiError({ type: 'https://erp.example/errors/not-found', title: `${what} not found`, status: 404, code: 'NOT_FOUND' });
  }
  static unauthorized(detail: string): ApiError {
    return new ApiError({ type: 'https://erp.example/errors/unauthorized', title: 'Authentication failed', status: 401, code: 'AUTH_INVALID_CREDENTIALS', detail });
  }
  static forbidden(permission: string): ApiError {
    return new ApiError({ type: 'https://erp.example/errors/forbidden', title: 'Not permitted', status: 403, code: 'FORBIDDEN', detail: permission });
  }
  static validation(errors: { field: string; message: string }[], title = 'Validation failed'): ApiError {
    return new ApiError({ type: 'https://erp.example/errors/validation', title, status: 400, code: 'VALIDATION_FAILED', errors });
  }
}
