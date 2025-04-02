import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('stripe-webhook-queue')
export class StripeWebhookProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }
  async process(job: Job): Promise<any> {
    const { eventType, eventData } = job.data;

    switch (eventType) {
      case 'payment_intent.payment_failed':
        await this.paymentFailed(eventData);
        break;
      default:
        console.log(`Unhandled Stripe webhook event: ${eventType}`);
        break;
    }
    return Promise.resolve({ success: true });
  }

  private async paymentFailed(data: any) {
    try {
      const payment = await this.prisma.payment.upsert({
        where: {
          transaction_id: data.id,
          AND: [{ orderid: data.metadata.orderId }],
        },
        create: {
          transaction_id: data.id,
          order: { connect: { id: data.metadata.orderId } },
          status: 'requires payment method',
          method: 'card',
          amount: data.amount,
        },
        update: {
          status: 'requires payment method',
        },
      });

      console.log(
        `Payment #${payment.id}: ${data.last_payment_error?.message}`,
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
