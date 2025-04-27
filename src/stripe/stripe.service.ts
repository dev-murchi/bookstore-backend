import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripeApiKey: string;
  private stripeWebhookKey: string;
  private stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    this.stripeApiKey = this.configService.get<string>('STRIPE_API_KEY');
    this.stripeWebhookKey = this.configService.get<string>('STRIPE_API_WHKEY');
    this.stripe = new Stripe(this.stripeApiKey);
  }

  async createCheckoutSession(data: Stripe.Checkout.SessionCreateParams) {
    return await this.stripe.checkout.sessions.create(data);
  }

  async constructWebhookEvent(payload: Buffer, signature: string) {
    if (!this.stripeWebhookKey)
      throw new Error('Stripe Webhook secret not configured.');

    try {
      return await this.stripe.webhooks.constructEventAsync(
        payload,
        signature,
        this.stripeWebhookKey,
      );
    } catch (error) {
      throw new Error(`Webhook Error: ${error.message}`);
    }
  }

  async createRefundForPayment(
    paymentIntent: string,
    metadata?: Stripe.Emptyable<Stripe.MetadataParam>,
  ) {
    return await this.stripe.refunds.create({
      payment_intent: paymentIntent,
      metadata,
    });
  }
}
