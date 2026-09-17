/**
 * Phase 18: Request Correlation Middleware
 * 
 * Injects a unique requestId (from X-Request-Id header or generated UUID)
 * onto the Express request and sets it in the response header.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

export function requestCorrelation(req: Request, res: Response, next: NextFunction): void {
  const incomingId = typeof req.header === 'function'
    ? req.header('X-Request-Id')
    : (req.headers?.['x-request-id'] as string || req.headers?.['X-Request-Id'] as string);
  const requestId = incomingId && incomingId.trim().length > 0 ? incomingId.trim() : `req-${crypto.randomUUID()}`;

  req.requestId = requestId;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', requestId);

  next();
}
