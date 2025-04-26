import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Inject } from '@nestjs/common';
import { StripeService } from '../payment/stripe.service';

@Processor('stripe-webhook-queue')
export class StripeWebhookProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private stripeService: StripeService,
    @Inject('MailSenderQueue') private readonly mailSenderQueue: Queue,
  ) {
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
    const orderId = parseInt(data.metadata.orderId);
    if (isNaN(orderId)) {
      throw new Error(`Invalid order ID: ${data.metadata.orderId}`);
    }

    try {
      await this.prisma.$transaction(async (pr) => {
        // fetch order
        const order = await pr.orders.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            order_items: {
              select: {
                quantity: true,
                book: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        });

        if (!order) {
          throw new Error(`Order not found: ${orderId}`);
        }

        // update order item stock count
        // the order item stock count was already updated when the order was canceled
        if (order.status !== 'canceled') {
          for (const item of order.order_items) {
            await pr.books.update({
              where: { id: item.book.id },
              data: { stock_quantity: { increment: item.quantity } },
            });
          }
        }

        // update order status as expired
        await pr.orders.update({
          where: { id: orderId },
          data: { status: 'expired' },
        });

        // update payment status as unpaid
        pr.payment.upsert({
          where: { orderid: orderId },
          update: { status: 'unpaid' },
          create: {
            order: { connect: { id: orderId } },
            status: 'unpaid',
            method: 'card',
            amount: data.amount_total,
          },
        });
      });

      console.log(`Order #[${orderId}] is expired.`);

      // send an email to the user after the transaction is complete
      await this.mailSenderQueue.add('order-status-mail', {
        orderId,
        email: data.customer_details.email,
        status: 'expired',
      });

      console.log(`Expiration email add to the queue for Order #[${orderId}]`);
    } catch (error) {
      console.error(
        `Error processing payment expired for Order #[${orderId}]:`,
        error,
      );
      throw error;
    }
  }

  private async paymentSuccessful(data: any) {
    const orderId = parseInt(data.metadata.orderId);
    if (isNaN(orderId)) {
      throw new Error(`Invalid order ID: ${data.metadata.orderId}`);
    }

    try {
      const { existingOrder } = await this.prisma.$transaction(async (pr) => {
        // fetch order
        const existingOrder = await pr.orders.findUnique({
          where: { id: orderId },
          select: { status: true },
        });

        if (!existingOrder) {
          throw new Error(`Order not found: ${orderId}`);
        }

        // update order status as complete
        const updatedOrder = await pr.orders.update({
          where: { id: orderId },
          data: {
            status: 'complete',
          },
        });

        // create shipping for the order
        const shipping = await pr.shipping.create({
          data: {
            email: data.customer_details.email,
            order: { connect: { id: orderId } },
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

        // update payment status as paid
        const payment = await pr.payment.upsert({
          where: {
            orderid: orderId,
          },
          update: {
            status: 'paid',
          },
          create: {
            order: { connect: { id: orderId } },
            transaction_id: data.payment_intent,
            status: 'paid',
            method: 'card',
            amount: data.amount_total,
            payment_date: new Date(),
          },
        });
        return { existingOrder, updatedOrder, shipping, payment };
      });

      console.log(`Order #[${orderId}] is complete.`);

      // create a refund if the order was canceled before the payment
      if (existingOrder.status === 'canceled') {
        // stripe.create.refund
        try {
          const refund = await this.stripeService.createRefundForPayment(
            data.payment_intent as string,
          );

          console.log(`Refund issued for cancelled order: ${orderId}`);
        } catch (error) {
          console.error('Refund failed:', error);
        }
      }

      // send an email to the user after the transaction is complete
      await this.mailSenderQueue.add('order-status-mail', {
        orderId,
        email: data.customer_details.email,
        status: 'complete',
      });

      console.log(
        `Order confirmation email add to the queue for Order #[${orderId}]`,
      );
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
