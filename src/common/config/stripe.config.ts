import { registerAs } from '@nestjs/config';

export const stripeConfig = registerAs('stripe', () => ({
  apiKey: process.env.STRIPE_API_KEY || 'stripe_api_key',
  whKey: process.env.STRIPE_WEBHOOK_KEY || 'stripe_wh_key',
}));
