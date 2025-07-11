import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrderEmailTemplateKey } from 'src/common/types/email-config.type';
import { StripeEventTypeCheckout } from 'src/common/types/stripe-event.type';
import { OrdersService } from 'src/orders/orders.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueService } from 'src/queue/queue.service';
import { StripeWebhookProcessorBase } from '../stripe-webhook-queue.processor.base';
import Stripe from 'stripe';

export const STRIPE_CHECKOUT_SESSION_HANDLER =
  'STRIPE_CHECKOUT_SESSION_HANDLER';
@Processor('stripe-checkout-queue')
export class StripeCheckoutProcessor extends StripeWebhookProcessorBase<
  Stripe.Checkout.Session,
  StripeEventTypeCheckout
> {
  private readonly emailMap = new Map<
    StripeEventTypeCheckout,
    OrderEmailTemplateKey
  >([
    ['checkout.session.completed', 'orderComplete'],
    ['checkout.session.expired', 'orderExpired'],
  ]);

  constructor(
    private readonly queueService: QueueService,
    protected readonly prisma: PrismaService,
    protected readonly ordersService: OrdersService,
    @Inject(STRIPE_CHECKOUT_SESSION_HANDLER)
    protected readonly allStripeHandlers: any[],
  ) {
    super(prisma, ordersService, allStripeHandlers);
  }

  async process(
    job: Job<Stripe.Checkout.Session, any, StripeEventTypeCheckout>,
  ) {
    const { success, log } = await this.processJob(job);
    const orderId = job.data.metadata['orderId'];
    const updatedOrder = await this.ordersService.getOrder(orderId);
    const result = {
      success,
      log,
      orderId,
      username: updatedOrder.owner.name,
      email: updatedOrder.owner.email,
    };

    return result;
  }

  @OnWorkerEvent('completed')
  async onComplete(
    job: Job<Stripe.Checkout.Session, any, StripeEventTypeCheckout>,
    result: any,
  ) {
    if (result.success) {
      const tKey = this.emailMap.get(job.name);
      if (tKey) {
        await this.queueService.addOrderMailJob(tKey, {
          orderId: result.orderId,
          email: result.email,
          username: result.username,
        });
      }
    }
  }
}
