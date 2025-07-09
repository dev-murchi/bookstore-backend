import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { RefundEmailTemplateKey } from '../../../common/types/email-config.type';
import { StripeEventTypeRefund } from '../../../common/types/stripe-event.type';
import { OrdersService } from '../../../orders/orders.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { QueueService } from '../../../queue/queue.service';
import { StripeWebhookProcessorBase } from '../stripe-webhook-queue.processor.base';
import Stripe from 'stripe';

export const STRIPE_REFUND_HANDLER = 'STRIPE_REFUND_HANDLER';
@Processor('stripe-refund-queue')
export class StripeRefundProcessor extends StripeWebhookProcessorBase<
  Stripe.Refund,
  StripeEventTypeRefund
> {
  private readonly emailMap = new Map<
    StripeEventTypeRefund,
    RefundEmailTemplateKey
  >([
    ['refund.created', 'refundCreated'],
    ['refund.updated', 'refundComplete'],
    ['refund.failed', 'refundFailed'],
  ]);

  constructor(
    private readonly queueService: QueueService,
    protected readonly prisma: PrismaService,
    protected readonly ordersService: OrdersService,
    @Inject(STRIPE_REFUND_HANDLER)
    protected readonly allStripeHandlers: any[],
  ) {
    super(prisma, ordersService, allStripeHandlers);
  }

  async process(job: Job<Stripe.Refund, any, StripeEventTypeRefund>) {
    const { success, log } = await this.processJob(job);
    const orderId = job.data.metadata['orderId'];
    const order = await this.ordersService.getOrder(orderId);
    const result = {
      success,
      log,
      orderId: job.data.metadata['orderId'],
      username: order.owner.name,
      email: order.owner.email,
      refundId: job.data.id,
    };

    return result;
  }

  @OnWorkerEvent('completed')
  async onComplete(
    job: Job<Stripe.Refund, any, StripeEventTypeRefund>,
    result: any,
  ) {
    if (result.success) {
      const tKey = this.emailMap.get(job.name);
      if (tKey) {
        await this.queueService.addOrderMailJob(tKey, {
          orderId: result.orderId,
          email: result.email,
          username: result.username,
          refundId: result.refundId,
        });
      }
    }
  }
}
