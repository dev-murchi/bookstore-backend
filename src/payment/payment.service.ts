import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { StripeService } from './stripe/stripe.service';
import { QueueService } from 'src/queue/queue.service';
import {
  StripeEventTypeCheckout,
  StripeEventTypePaymentIntent,
  StripeEventTypeRefund,
} from 'src/common/types/stripe-event.type';

const PaymentIntentEvents = new Set(['payment_intent.payment_failed']);
const CheckoutEvents = new Set([
  'checkout.session.expired',
  'checkout.session.completed',
]);
const RefundEvents = new Set([
  'refund.created',
  'refund.updated',
  'refund.failed',
]);

@Injectable()
export class PaymentService {
  constructor(
    private stripeService: StripeService,
    private queueService: QueueService,
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

      const eventType = event.type;
      const eventData = event.data.object;

      if (PaymentIntentEvents.has(eventType)) {
        await this.queueService.addStripePaymentJob({
          eventType: eventType as StripeEventTypePaymentIntent,
          eventData: eventData as Stripe.PaymentIntent,
        });
      } else if (CheckoutEvents.has(eventType)) {
        await this.queueService.addStripeCheckoutJob({
          eventType: eventType as StripeEventTypeCheckout,
          eventData: eventData as Stripe.Checkout.Session,
        });
      } else if (RefundEvents.has(eventType)) {
        await this.queueService.addStripeRefundJob({
          eventType: eventType as StripeEventTypeRefund,
          eventData: eventData as Stripe.Refund,
        });
      } else {
        console.error('Unknown Stripe event type:', eventType);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Webhook Error: ${error.message}`);
      }
      throw new Error('Webhook Error: Unexpected error');
    }
  }
}
