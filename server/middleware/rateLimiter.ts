/**
 * Phase 18: In-Memory Production Rate Limiter Middleware
 * 
 * Rules:
 * - Protects expensive endpoints (auth, research, backtests, uploads).
 * - Tracks requests per client key (IP or user ID).
 * - Safe 429 response with Retry-After header.
 * - Sliding window algorithm.
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

interface ClientRecord {
  timestamps: number[];
}

export class RateLimiter {
  private clients = new Map<string, ClientRecord>();
  private windowMs: number;
  private maxRequests: number;
  private message: string;

  constructor(config: RateLimitConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    this.message = config.message || 'Too many requests, please try again later.';
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const now = Date.now();
      // Derive client identifier: user ID if authenticated, else IP
      const clientId = (req as any).user?.userId || req.ip || req.socket.remoteAddress || 'unknown-client';
      
      let record = this.clients.get(clientId);
      if (!record) {
        record = { timestamps: [] };
        this.clients.set(clientId, record);
      }

      // Purge timestamps outside the current window
      const cutoff = now - this.windowMs;
      record.timestamps = record.timestamps.filter(ts => ts > cutoff);

      if (record.timestamps.length >= this.maxRequests) {
        const oldest = record.timestamps[0];
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
        
        res.setHeader('Retry-After', retryAfterSeconds.toString());
        res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: this.message,
            retryAfterSeconds,
            requestId: req.requestId || undefined,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      record.timestamps.push(now);
      next();
    };
  }

  public reset(): void {
    this.clients.clear();
  }
}

// Specialized rate limiters for high-risk and expensive operational paths
export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30,
  message: 'Too many authentication attempts. Please wait 15 minutes.'
});

export const researchRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
  message: 'Research API rate limit reached. Please wait 1 minute.'
});

export const backtestRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,
  message: 'Backtest evaluation rate limit reached. Please wait 1 minute.'
});

export const documentUploadRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,
  message: 'Document ingestion rate limit reached. Please wait 1 minute.'
});
