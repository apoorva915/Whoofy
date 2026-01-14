/**
 * Base Application Error
 */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super('NOT_FOUND', message, 404);
  }
}

/**
 * Unauthorized Error
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

/**
 * Forbidden Error
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

/**
 * External API Error
 */
export class ExternalApiError extends AppError {
  constructor(
    service: string,
    message: string,
    public originalError?: any
  ) {
    super(
      'EXTERNAL_API_ERROR',
      `${service} API error: ${message}`,
      502,
      originalError
    );
  }
}/**
 * Database Error
 */
export class DatabaseError extends AppError {
  constructor(message: string, public originalError?: any) {
    super('DATABASE_ERROR', `Database error: ${message}`, 500, originalError);
  }
}/**
 * Processing Error
 */
export class ProcessingError extends AppError {
  constructor(message: string, public originalError?: any) {
    super('PROCESSING_ERROR', `Processing error: ${message}`, 500, originalError);
  }
}/**
 * Rate Limit Error
 */
export class RateLimitError extends AppError {
  constructor(service: string, retryAfter?: number) {
    super(
      'RATE_LIMIT_ERROR',
      `Rate limit exceeded for ${service}`,
      429,
      { retryAfter }
    );
  }
}
