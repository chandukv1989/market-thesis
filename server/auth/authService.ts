/**
 * Phase 17: Authentication Service
 * 
 * Provides production-grade user registration, secure password hashing,
 * credential verification, and cryptographically secure session management.
 */

import crypto from 'crypto';
import { persistenceManager } from '../persistence/persistenceManager';
import { User, SafeUser, AuthenticatedSession, RegisterRequest, LoginRequest } from '../../src/types';

export class AuthenticationError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthenticationService {
  private static instance: AuthenticationService;
  private readonly SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  public static getInstance(): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }

  // --- PASSWORD HASHING ---

  public hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  public verifyPassword(password: string, storedHash: string): boolean {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  }

  public normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  public validateEmailFormat(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // --- USER REGISTRATION ---

  public async register(
    req: RegisterRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: SafeUser; session: AuthenticatedSession }> {
    if (!req.email || !this.validateEmailFormat(req.email)) {
      throw new AuthenticationError('Valid email address is required', 400);
    }

    if (!req.password || req.password.length < 8) {
      throw new AuthenticationError('Password must be at least 8 characters long', 400);
    }

    const normalizedEmail = this.normalizeEmail(req.email);
    const userRepo = persistenceManager.getUserRepository();

    const existing = await userRepo.getByEmail(normalizedEmail);
    if (existing) {
      throw new AuthenticationError('An account with this email already exists', 409);
    }

    const userId = `usr_${crypto.randomUUID()}`;
    const passwordHash = this.hashPassword(req.password);
    const now = new Date().toISOString();

    const newUser: User = {
      userId,
      email: req.email.trim(),
      normalizedEmail,
      passwordHash,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    };

    const savedUser = await userRepo.save(newUser);
    const session = await this.createSession(savedUser.userId, ipAddress, userAgent);

    return {
      user: this.toSafeUser(savedUser),
      session
    };
  }

  // --- USER LOGIN ---

  public async login(
    req: LoginRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: SafeUser; session: AuthenticatedSession }> {
    if (!req.email || !req.password) {
      throw new AuthenticationError('Email and password are required', 400);
    }

    const normalizedEmail = this.normalizeEmail(req.email);
    const userRepo = persistenceManager.getUserRepository();
    const user = await userRepo.getByEmail(normalizedEmail);

    if (!user) {
      throw new AuthenticationError('Invalid email or password', 401);
    }

    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('User account is disabled', 403);
    }

    const isValid = this.verifyPassword(req.password, user.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('Invalid email or password', 401);
    }

    // Update last login timestamp
    const now = new Date().toISOString();
    await userRepo.update(user.userId, { lastLoginAt: now });

    const session = await this.createSession(user.userId, ipAddress, userAgent);

    return {
      user: this.toSafeUser(user),
      session
    };
  }

  // --- SESSION MANAGEMENT ---

  public async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthenticatedSession> {
    const sessionId = `sess_${crypto.randomBytes(32).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_DURATION_MS).toISOString();

    const session: AuthenticatedSession = {
      sessionId,
      userId,
      createdAt: now.toISOString(),
      expiresAt,
      lastActivityAt: now.toISOString(),
      ipAddress,
      userAgent,
      isValid: true
    };

    const sessionRepo = persistenceManager.getSessionRepository();
    return await sessionRepo.save(session);
  }

  public async validateSession(
    sessionId: string
  ): Promise<{ user: SafeUser; session: AuthenticatedSession } | null> {
    if (!sessionId) return null;

    const sessionRepo = persistenceManager.getSessionRepository();
    const session = await sessionRepo.get(sessionId);
    if (!session || !session.isValid) return null;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await sessionRepo.invalidate(sessionId);
      return null;
    }

    const userRepo = persistenceManager.getUserRepository();
    const user = await userRepo.get(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    // Touch lastActivityAt if more than 5 minutes since last activity
    const lastActivity = new Date(session.lastActivityAt).getTime();
    if (Date.now() - lastActivity > 5 * 60 * 1000) {
      session.lastActivityAt = new Date().toISOString();
      await sessionRepo.save(session);
    }

    return {
      user: this.toSafeUser(user),
      session
    };
  }

  public async logout(sessionId: string): Promise<boolean> {
    if (!sessionId) return false;
    const sessionRepo = persistenceManager.getSessionRepository();
    return await sessionRepo.invalidate(sessionId);
  }

  public async logoutAll(userId: string): Promise<number> {
    const sessionRepo = persistenceManager.getSessionRepository();
    return await sessionRepo.invalidateAllForUser(userId);
  }

  public toSafeUser(user: User): SafeUser {
    return {
      userId: user.userId,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };
  }
}

export const authService = AuthenticationService.getInstance();
