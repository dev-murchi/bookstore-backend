import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import { StripeService } from './stripe/stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentData } from '../common/types/payment-data.interface';
import { PaymentDTO } from '../common/dto/payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
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

  async createOrUpdatePayment(data: PaymentData) {
    try {
      const savedPayment = await this.prisma.payment.upsert({
        where: { orderid: data.orderId },
        create: {
          transaction_id: data.transactionId,
          order: { connect: { id: data.orderId } },
          status: data.status,
          method: 'card',
          amount: data.amount,
        },
        update: {
          status: data.status,
        },
      });

      const payment = new PaymentDTO();
      payment.id = savedPayment.id;
      payment.amount = Number(savedPayment.amount.toFixed(2));
      payment.method = savedPayment.method;
      payment.status = savedPayment.status;
      payment.transactionId = savedPayment.transaction_id;

      return payment;
    } catch (error) {
      console.error('Unexpected error during payment upsert:', error);
      throw new Error(
        'An internal server error occurred. Please try again later.',
      );
    }
  }
}
