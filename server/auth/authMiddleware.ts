/**
 * Phase 17: Authentication Middleware
 * 
 * Intercepts requests, resolves user sessions via headers or cookies,
 * and enforces route protection for private investment endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from './authService';
import { SafeUser, AuthenticatedSession } from '../../src/types';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      session?: AuthenticatedSession;
    }
  }
}

/**
 * Extracts session ID from Authorization header, custom header, or cookie
 */
export function extractSessionId(req: Request): string | null {
  // 1. Authorization: Bearer <sessionId>
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // 2. Custom header: X-Session-Id
  const customHeader = req.headers['x-session-id'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  // 3. Cookie: session_id
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('session_id=')) {
        return decodeURIComponent(cookie.slice('session_id='.length));
      }
    }
  }

  return null;
}

/**
 * Middleware that resolves current authenticated user if a valid session exists.
 * Does not block unauthenticated requests (allows public endpoints to proceed).
 */
export async function resolveUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = extractSessionId(req);
    if (sessionId) {
      const result = await authService.validateSession(sessionId);
      if (result) {
        req.user = result.user;
        req.session = result.session;
      }
    }
    next();
  } catch (err) {
    // Session validation error shouldn't crash the request, just leave req.user undefined
    next();
  }
}

/**
 * Middleware that strictly enforces user authentication.
 * Rejects unauthenticated requests with 401 Unauthorized.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.session) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required to access this resource',
      code: 'AUTH_REQUIRED'
    });
    return;
  }
  next();
}

/**
 * Helper to set secure session cookie
 */
export function setSessionCookie(res: Response, sessionId: string, expiresAt: string, isSecure = process.env.NODE_ENV === 'production'): void {
  const expires = new Date(expiresAt).toUTCString();
  const secureFlag = isSecure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `session_id=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}${secureFlag}`);
}

/**
 * Helper to clear session cookie
 */
export function clearSessionCookie(res: Response, isSecure = process.env.NODE_ENV === 'production'): void {
  const secureFlag = isSecure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `session_id=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`);
}
