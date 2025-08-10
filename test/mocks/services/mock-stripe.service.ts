import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class MockStripeService {
  async createCheckoutSession(data: Stripe.Checkout.SessionCreateParams) {
    return { url: 'https://test-url.com', expires_at: 1234567890 };
  }

  async constructWebhookEvent(payload: Buffer, signature: string) {
    return {
      type: 'checkout.session.completed',
      data: {
        object: {},
      },
    };
  }

  async createRefundForPayment(
    paymentIntent: string,
    metadata?: Stripe.Emptyable<Stripe.MetadataParam>,
  ) {
    return { id: 're_12345', status: 'succeeded' };
  }
}
