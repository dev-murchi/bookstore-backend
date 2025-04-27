import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Inject } from '@nestjs/common';
import { StripeService } from '../stripe/stripe.service';

export interface StripeMetadata {
  orderId: string;
}

export interface StripeAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
}

export interface StripeCustomerDetails {
  email: string;
  address: StripeAddress;
}

export interface StripeSessionData {
  id: string;
  object: string;
  currency: string;
  payment_intent?: string;
  payment_status: string;
  status: string;
  amount_total: number;
  metadata?: StripeMetadata;
  customer_details: StripeCustomerDetails;
  last_payment_error?: { message: string };
}

export interface StripePaymentData {
  id: string;
  object: string;
  amount: number;
  metadata?: StripeMetadata;
  last_payment_error: { message: string } | null;
  status: string;
}

@Processor('stripe-webhook-queue')
export class StripeWebhookProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
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
        console.warn(`Unhandled Stripe webhook event: ${eventType}`);
        break;
    }
    return Promise.resolve({ success: true });
  }

  private async paymentFailed(data: StripePaymentData): Promise<void> {
    const orderId = parseInt(data.metadata?.orderId ?? '');
    if (isNaN(orderId)) {
      throw new Error(`Invalid or missing order ID: ${data.metadata?.orderId}`);
    }

    try {
      const payment = await this.prisma.payment.upsert({
        where: { orderid: orderId },
        create: {
          transaction_id: data.id,
          order: { connect: { id: orderId } },
          status: 'failed',
          method: 'card',
          amount: data.amount,
        },
        update: {
          status: 'failed',
        },
      });

      console.warn(
        `Payment #${payment.id} failed: ${data.last_payment_error?.message}`,
      );
    } catch (error) {
      console.error(
        `Payment failure handling error for order ID ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  private async paymentExpired(data: StripeSessionData): Promise<void> {
    const orderId = parseInt(data.metadata?.orderId ?? '');
    if (isNaN(orderId)) {
      throw new Error(`Invalid or missing order ID: ${data.metadata?.orderId}`);
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
                book: { select: { id: true } },
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

      // send an email to the user after the transaction is complete
      await this.mailSenderQueue.add('order-status-mail', {
        orderId,
        email: data.customer_details.email,
        status: 'expired',
      });

      console.warn(
        `Order #[${orderId}] expired and expiration email added to the queue.`,
      );
    } catch (error) {
      console.error(
        `Error processing expired payment for Order #[${orderId}]:`,
        error,
      );
      throw error;
    }
  }

  private async paymentSuccessful(data: StripeSessionData): Promise<void> {
    const orderId = parseInt(data.metadata?.orderId ?? '');
    if (isNaN(orderId)) {
      throw new Error(`Invalid or missing order ID: ${data.metadata?.orderId}`);
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
          data: { status: 'complete' },
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
                streetAddress: `${data.customer_details.address.line1} - ${data.customer_details.address.line2 ?? ''}`,
                postalCode: data.customer_details.address.postal_code,
              },
            },
          },
        });

        // update payment status as paid
        const payment = await pr.payment.upsert({
          where: { orderid: orderId },
          update: { status: 'paid' },
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

      // create a refund if the order was canceled before the payment
      if (existingOrder.status === 'canceled') {
        try {
          await this.stripeService.createRefundForPayment(
            data.payment_intent!,
            { orderId },
          );
          console.warn(
            `Refund issued for previously canceled order: ${orderId}`,
          );
        } catch (error) {
          console.error(`Refund failed for order ID ${orderId}:`, error);
        }
      }

      // send an email to the user after the transaction is complete
      await this.mailSenderQueue.add('order-status-mail', {
        orderId,
        email: data.customer_details.email,
        status: 'complete',
      });

      console.warn(
        `Order #[${orderId}] marked as complete and order confirmation email added to queue.`,
      );
    } catch (error) {
      console.error(`Error finalizing payment for order ID ${orderId}:`, error);
      throw error;
    }
  }
}
