import { registerAs } from '@nestjs/config';
import { RatelimitConfig } from '../types/ratelimit-config.type';

export const config: RatelimitConfig = {
  short: {
    ttl: Number(process.env.RATELIMIT_SHORT_TTL) || 1000,
    limit: Number(process.env.RATELIMIT_SHORT_REQ_COUNT) || 5,
  },
  medium: {
    ttl: Number(process.env.RATELIMIT_MEDIUM_TTL) || 10000,
    limit: Number(process.env.RATELIMIT_MEDIUM_REQ_COUNT) || 20,
  },
  long: {
    ttl: Number(process.env.RATELIMIT_LONG_TTL) || 60000,
    limit: Number(process.env.RATELIMIT_LONG_REQ_COUNT) || 100,
  },
};

export const ratelimitConfig = registerAs('ratelimit', () => config);
