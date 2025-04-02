import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private stripeApiKey: string;
  private stripeWebhookKey: string;

  private readonly stripe: Stripe;
  constructor(
    private readonly configService: ConfigService,
    @Inject('StripeWebhookQueue') private readonly stripeWebhookQueue: Queue,
  ) {
    this.stripeApiKey = this.configService.get<string>('STRIPE_API_KEY');
    this.stripeWebhookKey = this.configService.get<string>('STRIPE_API_WHKEY');
    this.stripe = new Stripe(this.stripeApiKey);
  }

  async createCheckoutSession(data: Stripe.Checkout.SessionCreateParams) {
    const session = await this.stripe.checkout.sessions.create(data);
    return {
      url: session.url,
      expires: session.expires_at,
    };
  }

  async handleStripeWebhook(payload: Buffer, signature: string) {
    if (!this.stripeWebhookKey)
      throw new Error('Stripe Webhook secret not configured.');

    try {
      const event = await this.stripe.webhooks.constructEventAsync(
        payload,
        signature,
        this.stripeWebhookKey,
      );
      // add stripe event into queue
      await this.stripeWebhookQueue.add('process-event', {
        eventType: event.type,
        eventData: event.data.object,
      });
    } catch (error) {
      throw new Error(`Webhook Error: ${error.message}`);
    }
  }
}
