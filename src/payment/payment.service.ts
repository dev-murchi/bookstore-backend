import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentService {
  constructor(
    private stripeService: StripeService,
    @Inject('StripeWebhookQueue') private readonly stripeWebhookQueue: Queue,
  ) {}

  async createCheckoutSession(data: Stripe.Checkout.SessionCreateParams) {
    const session = await this.stripeService.createCheckoutSession(data);
    return {
      url: session.url,
      expires: session.expires_at,
    };
  }

  async handleStripeWebhook(payload: Buffer, signature: string) {
    try {
      const event = await this.stripeService.constructWebhookEvent(
        payload,
        signature,
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
