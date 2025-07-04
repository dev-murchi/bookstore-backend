import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import { StripeService } from './stripe/stripe.service';

@Injectable()
export class PaymentService {
  constructor(
    private stripeService: StripeService,
    @Inject('StripeWebhookQueue') private readonly stripeWebhookQueue: Queue,
  ) {}

  async createStripeCheckoutSession(data: Stripe.Checkout.SessionCreateParams) {
    try {
      const session = await this.stripeService.createCheckoutSession(data);
      return {
        url: session.url,
        expires: session.expires_at,
      };
    } catch (error) {
      console.error('Error:', error);
      throw new Error('Stripe checkout session creation failed.');
    }
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
      console.error('Stripe Webhook Error:', error);
      throw new Error(`Webhook Error: ${error.message}`);
    }
  }
}
