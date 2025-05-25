import { registerAs } from '@nestjs/config';

export const emailConfig = registerAs('email', () => ({
  host: process.env.EMAIL_HOST || 'stmp.example.com',
  port: Number.parseInt(process.env.EMAIL_PORT, 10) || 587,
  user: process.env.EMAIL_USER || 'your@email.com',
  password: process.env.EMAIL_PASS || 'your_password',
}));
