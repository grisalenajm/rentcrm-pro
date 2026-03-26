import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

export interface AppLogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  context: string;
  message: string;
  details?: any;
  createdAt: string;
}

const REDIS_KEY = 'app:logs';
const MAX_ENTRIES = 500;

@Injectable()
export class LogsService implements OnModuleDestroy {
  private readonly logger = new Logger(LogsService.name);
  private readonly redis: Redis;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const password = process.env.REDIS_PASSWORD;
    this.redis = new Redis(url, { lazyConnect: false, ...(password ? { password } : {}) });
    this.redis.on('error', (err) => this.logger.error('Redis error', err.message));
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  async add(level: AppLogEntry['level'], context: string, message: string, details?: any) {
    const entry: AppLogEntry = {
      id: randomUUID(),
      level,
      context,
      message,
      details: details ?? undefined,
      createdAt: new Date().toISOString(),
    };
    try {
      await this.redis.lpush(REDIS_KEY, JSON.stringify(entry));
      await this.redis.ltrim(REDIS_KEY, 0, MAX_ENTRIES - 1);
    } catch (e) {
      this.logger.error(`Failed to persist log entry: ${e.message}`);
    }
  }

  async findAll(limit = 200, level?: string, context?: string): Promise<AppLogEntry[]> {
    try {
      const raw = await this.redis.lrange(REDIS_KEY, 0, MAX_ENTRIES - 1);
      let entries: AppLogEntry[] = raw.map(r => JSON.parse(r));
      if (level) entries = entries.filter(e => e.level === level);
      if (context) entries = entries.filter(e => e.context.toLowerCase() === context.toLowerCase());
      return entries.slice(0, limit);
    } catch (e) {
      this.logger.error(`Failed to read logs: ${e.message}`);
      return [];
    }
  }

  async clear() {
    await this.redis.del(REDIS_KEY);
  }
}
