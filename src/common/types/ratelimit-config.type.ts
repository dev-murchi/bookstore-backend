export interface RatelimitConfig {
  [key: string]: { ttl: number; limit: number };
}
