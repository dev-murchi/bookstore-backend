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
      case 'checkout.session.expired':
        await this.paymentExpired(eventData);
        break;

      case 'checkout.session.completed':
        await this.paymentSuccessful(eventData);
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
          orderid: parseInt(data.metadata.orderId),
        },
        create: {
          transaction_id: data.id,
          order: { connect: { id: parseInt(data.metadata.orderId) } },
          status: 'failed',
          method: 'card',
          amount: data.amount,
        },
        update: {
          status: 'failed',
        },
      });

      console.log(
        `Payment #${payment.id}: ${data.last_payment_error?.message}`,
      );
    } catch (error) {
      throw error;
    }
  }
  private async paymentExpired(data: any) {
    try {
      await this.prisma.$transaction(async (pr) => {
        // update order status
        const order = await pr.orders.update({
          where: { id: parseInt(data.metadata.orderId) },
          data: {
            status: 'expired',
          },
          select: {
            id: true,
            order_items: {
              select: {
                id: true,
                quantity: true,
                bookid: true,
              },
            },
            payment: {
              select: { id: true },
            },
          },
        });

        // update order item stock count
        for (const item of order.order_items) {
          await pr.books.update({
            where: { id: item.bookid },
            data: { stock_quantity: { increment: item.quantity } },
            select: { id: true, stock_quantity: true },
          });
        }

        // upsert payment
        await pr.payment.upsert({
          where: {
            orderid: order.id,
          },
          update: {
            status: 'unpaid',
          },
          create: {
            order: { connect: { id: parseInt(data.metadata.orderId) } },
            status: 'unpaid',
            method: 'card',
            amount: data.amount_total,
          },
        });
        console.log(`Order #[${data.metadata.orderId}] is expired.`);
      });
    } catch (error) {
      throw error;
    }
  }

  private async paymentSuccessful(data: any) {
    try {
      await this.prisma.$transaction(async (pr) => {
        await pr.orders.update({
          where: { id: parseInt(data.metadata.orderId) },
          data: {
            status: 'complete',
          },
        });

        await pr.shipping.create({
          data: {
            email: data.customer_details.email,
            order: { connect: { id: parseInt(data.metadata.orderId) } },
            address: {
              create: {
                country: data.customer_details.address.country,
                state: data.customer_details.address.state,
                city: data.customer_details.address.city,
                streetAddress: `${data.customer_details.address.line1} - ${data.customer_details.address.line2}`,
                postalCode: data.customer_details.address.postal_code,
              },
            },
          },
        });

        await pr.payment.upsert({
          where: {
            orderid: parseInt(data.metadata.orderId),
          },
          update: {
            status: 'paid',
          },
          create: {
            order: { connect: { id: parseInt(data.metadata.orderId) } },
            transaction_id: data.payment_intent,
            status: 'paid',
            method: 'card',
            amount: data.amount_total,
          },
        });
      });
    } catch (error) {
      throw error;
    }

    console.log(`Order #[${data.metadata.orderId}] is completed.`);
  }
}
