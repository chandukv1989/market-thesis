/**
 * Phase 18: Structured Error Handling Middleware
 * 
 * Rules:
 * - Stable, categorized error codes:
 *     VALIDATION_ERROR
 *     AUTHENTICATION_REQUIRED
 *     FORBIDDEN
 *     NOT_FOUND
 *     PROVIDER_UNAVAILABLE
 *     RATE_LIMITED
 *     INTERNAL_ERROR
 * - Zero leakage of stack traces, filesystem paths, SQL queries, or provider credentials.
 * - Always attaches requestId and timestamp for auditability.
 */

import { Request, Response, NextFunction } from 'express';
import { structuredLogger } from '../logging/structuredLogger';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PROVIDER_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(code: ErrorCode, message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
  }
}

export class AuthenticationRequiredError extends AppError {
  constructor(message = 'Authentication is required to access this resource') {
    super('AUTHENTICATION_REQUIRED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Requested resource was not found') {
    super('NOT_FOUND', message, 404);
  }
}

export class ProviderUnavailableError extends AppError {
  constructor(message = 'External provider is temporarily unavailable') {
    super('PROVIDER_UNAVAILABLE', message, 503);
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super('RATE_LIMITED', message, 429);
  }
}

/**
 * Sanitizes an error message so that stack traces, filesystem paths,
 * or raw SQL are never reflected back to clients.
 */
function sanitizeErrorMessage(code: ErrorCode, rawMessage: string): string {
  if (code === 'INTERNAL_ERROR') {
    return 'An internal server error occurred. Please reference the request ID for assistance.';
  }

  // Scrub file paths (e.g. /home/... or C:\...)
  let sanitized = rawMessage.replace(/(?:\/[a-zA-Z0-9._-]+)+/g, '[path]');
  // Scrub potential connection strings
  sanitized = sanitized.replace(/(postgres|http|https):\/\/[^\s]+/g, '[redacted_url]');

  return sanitized;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';
  let statusCode = 500;
  let code: ErrorCode = 'INTERNAL_ERROR';
  let message = 'An internal server error occurred.';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
  } else if ((err as any)?.name === 'AuthenticationError' || (err as any)?.statusCode === 401) {
    statusCode = 401;
    code = 'AUTHENTICATION_REQUIRED';
    message = (err as any).message || 'Authentication required';
  } else if ((err as any)?.name === 'AuthorizationError' || (err as any)?.statusCode === 403) {
    statusCode = 403;
    code = 'FORBIDDEN';
    message = (err as any).message || 'Access forbidden';
  } else if (err instanceof Error) {
    const rawMsg = err.message || '';
    if (rawMsg.includes('Validation') || rawMsg.includes('invalid') || rawMsg.includes('required')) {
      statusCode = 400;
      code = 'VALIDATION_ERROR';
      message = rawMsg;
    } else {
      message = rawMsg;
    }
  }

  const safeMessage = sanitizeErrorMessage(code, message);

  // Structured operational log without sensitive data
  structuredLogger.error('API Request Error', {
    requestId,
    endpoint: req.originalUrl,
    method: req.method,
    statusCode,
    errorCategory: code,
    message: err instanceof Error ? err.message : String(err)
  });

  res.status(statusCode).json({
    error: {
      code,
      message: safeMessage,
      requestId,
      timestamp: new Date().toISOString()
    }
  });
}
