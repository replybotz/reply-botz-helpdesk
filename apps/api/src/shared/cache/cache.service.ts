import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.cache.get<T>(key);
    return value !== undefined ? value : null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.cache.set(key, value, ttlSeconds ? ttlSeconds * 1000 : undefined);
  }

  async del(key: string): Promise<void> {
    await this.cache.del(key);
  }

  async reset(): Promise<void> {
    await this.cache.reset();
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  static keys = {
    user: (id: string) => `user:${id}`,
    org: (id: string) => `org:${id}`,
    orgBySlug: (slug: string) => `org:slug:${slug}`,
    conversation: (id: string) => `conversation:${id}`,
    lmsUser: (integrationId: string, lmsUserId: string) =>
      `lms_user:${integrationId}:${lmsUserId}`,
    kbSearch: (orgId: string, query: string) => `kb:search:${orgId}:${query}`,
  };
}
