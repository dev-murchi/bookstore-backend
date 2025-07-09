import { Processor } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { StripeEventTypePaymentIntent } from '../../../common/types/stripe-event.type';
import { OrdersService } from '../../../orders/orders.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripeWebhookProcessorBase } from '../stripe-webhook-queue.processor.base';
import Stripe from 'stripe';

export const STRIPE_PAYMENT_HANDLER = 'STRIPE_PAYMENT_HANDLER';
@Processor('stripe-payment-queue')
export class StripePaymentProcessor extends StripeWebhookProcessorBase<
  Stripe.PaymentIntent,
  StripeEventTypePaymentIntent
> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly ordersService: OrdersService,
    @Inject(STRIPE_PAYMENT_HANDLER)
    protected readonly allStripeHandlers: any[],
  ) {
    super(prisma, ordersService, allStripeHandlers);
  }

  async process(
    job: Job<Stripe.PaymentIntent, any, StripeEventTypePaymentIntent>,
  ) {
    const { success, log } = await this.processJob(job);
    return { success, log };
  }
}
