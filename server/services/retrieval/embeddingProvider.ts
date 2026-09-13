/**
 * Embedding Provider Abstraction & Google GenAI Integration (Phase 8B)
 * 
 * Provides an embedding abstraction with lazy Google GenAI initialization,
 * local caching, credential isolation, and graceful fallback to lexical retrieval
 * when credentials or quota are unavailable.
 */

import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import { EmbeddingStatus } from '../../../src/types';

export interface IEmbeddingProvider {
  embedText(text: string): Promise<number[] | null>;
  embedTexts(texts: string[]): Promise<(number[] | null)[]>;
  getStatus(): EmbeddingStatus;
  clearCache?(): void;
}

/**
 * Compute cosine similarity between two numeric vectors.
 * Returns 0 if vectors are empty, unequal lengths, or zero-magnitude.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const sim = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Clamp between -1 and 1 (or 0 and 1 for normalized non-negative embeddings)
  return Math.max(-1, Math.min(1, sim));
}

/**
 * Google GenAI (text-embedding-004) Provider.
 * Server-side only: never transmits API key to client.
 */
export class GoogleGenAIEmbeddingProvider implements IEmbeddingProvider {
  private client: GoogleGenAI | null = null;
  private readonly modelName: string;
  private readonly cache: Map<string, number[]> = new Map();
  private readonly maxCacheSize: number = 2000;
  private lastErrorMessage: string | null = null;
  private isKeyConfigured: boolean;

  constructor(modelName: string = 'text-embedding-004') {
    this.modelName = modelName;
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    this.isKeyConfigured = Boolean(apiKey);
    if (this.isKeyConfigured && apiKey) {
      try {
        this.client = new GoogleGenAI({ apiKey });
      } catch (err: unknown) {
        this.lastErrorMessage = err instanceof Error ? err.message : String(err);
        this.client = null;
      }
    }
  }

  public getStatus(): EmbeddingStatus {
    if (!this.isKeyConfigured || !this.client) {
      return {
        configured: false,
        model: this.modelName,
        status: 'UNAVAILABLE',
        message: 'GEMINI_API_KEY environment variable is not configured or client initialization failed'
      };
    }

    if (this.lastErrorMessage) {
      return {
        configured: true,
        model: this.modelName,
        status: 'FALLBACK',
        message: `Embedding fallback active: ${this.lastErrorMessage}`
      };
    }

    return {
      configured: true,
      model: this.modelName,
      status: 'ACTIVE'
    };
  }

  public async embedText(text: string): Promise<number[] | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;

    // Check in-memory cache
    const cacheKey = this.computeHash(trimmed);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    if (!this.client || !this.isKeyConfigured) {
      return null;
    }

    try {
      // Truncate to reasonable token limit (e.g. 2048 characters)
      const input = trimmed.length > 2048 ? trimmed.substring(0, 2048) : trimmed;
      const response = await this.client.models.embedContent({
        model: this.modelName,
        contents: input
      });

      // Extract vector values safely from SDK response
      const rawValues =
        (response as any)?.embedding?.values ||
        (response as any)?.values ||
        (Array.isArray(response) ? response : null);

      if (Array.isArray(rawValues) && rawValues.length > 0) {
        // Enforce cache size limit
        if (this.cache.size >= this.maxCacheSize) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(cacheKey, rawValues);
        this.lastErrorMessage = null;
        return rawValues;
      }

      return null;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.lastErrorMessage = errMsg;
      // Do not crash, allow fallback to deterministic retrieval
      return null;
    }
  }

  public async embedTexts(texts: string[]): Promise<(number[] | null)[]> {
    if (!Array.isArray(texts) || texts.length === 0) return [];

    // Process sequentially or with small batches to avoid rate limits
    const results: (number[] | null)[] = [];
    for (const text of texts) {
      const vec = await this.embedText(text);
      results.push(vec);
    }
    return results;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  private computeHash(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}

/**
 * Deterministic Test/Mock Embedding Provider.
 * Generates pseudo-embeddings for testing semantic ranking without external API calls.
 */
export class MockEmbeddingProvider implements IEmbeddingProvider {
  private readonly dimensions: number;
  private readonly modelName: string;
  private status: 'ACTIVE' | 'UNAVAILABLE' | 'FALLBACK';
  private configured: boolean;

  constructor(
    dimensions: number = 64,
    status: 'ACTIVE' | 'UNAVAILABLE' | 'FALLBACK' = 'ACTIVE',
    configured: boolean = true
  ) {
    this.dimensions = dimensions;
    this.modelName = 'mock-text-embedding-test';
    this.status = status;
    this.configured = configured;
  }

  public setStatus(status: 'ACTIVE' | 'UNAVAILABLE' | 'FALLBACK', configured: boolean = true) {
    this.status = status;
    this.configured = configured;
  }

  public getStatus(): EmbeddingStatus {
    return {
      configured: this.configured,
      model: this.modelName,
      status: this.status,
      message: this.status !== 'ACTIVE' ? 'Mock embedding provider is in fallback/unavailable state' : undefined
    };
  }

  public async embedText(text: string): Promise<number[] | null> {
    if (this.status !== 'ACTIVE' || !this.configured) {
      return null;
    }

    const trimmed = (text || '').toLowerCase().trim();
    if (!trimmed) return null;

    // Generate deterministic normalized unit vector using simple character/word hashing
    const vector = new Array(this.dimensions).fill(0);
    const words = trimmed.split(/\W+/).filter(Boolean);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let c = 0; c < word.length; c++) {
        hash = (hash * 31 + word.charCodeAt(c)) % this.dimensions;
      }
      const idx = Math.abs(hash) % this.dimensions;
      vector[idx] += 1.0 / (1.0 + i * 0.1);
    }

    // Normalize to unit length
    let sumSq = 0;
    for (let i = 0; i < this.dimensions; i++) {
      sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] /= norm;
      }
    } else {
      vector[0] = 1.0;
    }

    return vector;
  }

  public async embedTexts(texts: string[]): Promise<(number[] | null)[]> {
    return Promise.all(texts.map(t => this.embedText(t)));
  }

  public clearCache(): void {}
}

// Global default provider singleton
let globalEmbeddingProvider: IEmbeddingProvider = new GoogleGenAIEmbeddingProvider();

export function getEmbeddingProvider(): IEmbeddingProvider {
  return globalEmbeddingProvider;
}

export function setEmbeddingProvider(provider: IEmbeddingProvider): void {
  globalEmbeddingProvider = provider;
}
