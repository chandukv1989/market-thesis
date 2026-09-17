/**
 * Phase 18: Structured Operational Logger & Credential Scrubber
 * 
 * Rules:
 * - Logs operational metadata only: requestId, endpoint, latency, status, error category.
 * - Credential Scrubber: Automatically scrubs any sensitive keys (passwords, tokens, keys, DB URLs).
 */

const SENSITIVE_KEY_REGEX = /(password|token|secret|apiKey|api_key|auth|authorization|cookie|database_url|access_token)/i;

export function scrubSensitiveData(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('postgres://') || obj.startsWith('postgresql://')) {
      return '[SCRUBBED_DATABASE_URL]';
    }
    if (obj.startsWith('Bearer ')) {
      return '[SCRUBBED]';
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => scrubSensitiveData(item, depth + 1));
  }
  if (typeof obj === 'object') {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        scrubbed[key] = '[SCRUBBED]';
      } else {
        scrubbed[key] = scrubSensitiveData(val, depth + 1);
      }
    }
    return scrubbed;
  }
  return obj;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  latencyMs?: number;
  provider?: string;
  errorCategory?: string;
  userId?: string;
  securityId?: string;
  metadata?: Record<string, unknown>;
}

export class StructuredLogger {
  public log(entry: Omit<StructuredLogEntry, 'timestamp'>): void {
    const fullEntry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
      metadata: entry.metadata ? (scrubSensitiveData(entry.metadata) as Record<string, unknown>) : undefined
    };

    const out = JSON.stringify(fullEntry);
    if (entry.level === 'error') {
      console.error(out);
    } else if (entry.level === 'warn') {
      console.warn(out);
    } else {
      console.log(out);
    }
  }

  public info(message: string, context?: Partial<StructuredLogEntry>): void {
    this.log({ level: 'info', message, ...context });
  }

  public warn(message: string, context?: Partial<StructuredLogEntry>): void {
    this.log({ level: 'warn', message, ...context });
  }

  public error(message: string, context?: Partial<StructuredLogEntry>): void {
    this.log({ level: 'error', message, ...context });
  }
}

export const structuredLogger = new StructuredLogger();
