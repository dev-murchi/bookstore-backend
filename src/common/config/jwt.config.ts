import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'default_jwt_secret',
  expiresIn: process.env.JWT_EXPIRES_IN || '1d',
}));
