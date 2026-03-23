import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const password = process.env.REDIS_PASSWORD;
    this.client = new Redis(url, { lazyConnect: false, ...(password ? { password } : {}) });
    this.client.on('error', (err) => this.logger.error('Redis error', err.message));
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
