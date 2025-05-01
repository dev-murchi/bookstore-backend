import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { PaymentService } from '../payment/payment.service';
import { OrdersService } from '../orders/orders.service';
import { EmailService } from '../email/email.service';
import {
  ShippingCustomerDetails,
  ShippingService,
} from '../orders/shipping/shipping.service';
import { PaymentData } from '../payment/interfaces/payment-data.interface';
import { PaymentStatus } from '../payment/enum/payment-status.enum';
import { OrderStatus } from '../orders/enum/order-status.enum';

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
    private readonly paymentService: PaymentService,
    private readonly ordersService: OrdersService,
    private readonly emailService: EmailService,
    private readonly shippingService: ShippingService,
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
    const orderId = this.parseOrderId(data.metadata);
    const paymentData: PaymentData = {
      orderId: orderId,
      transactionId: data.id,
      status: PaymentStatus.Failed,
      amount: data.amount,
    };

    try {
      await this.paymentService.createOrUpdatePayment(paymentData);
    } catch (error) {
      console.error(
        `Failed to process 'payment_failed' for Order ID ${orderId}:`,
        error,
      );
      throw new Error(`Payment failure handling failed for Order ${orderId}.`);
    }
  }

  private async paymentExpired(data: StripeSessionData): Promise<void> {
    const orderId = this.parseOrderId(data.metadata);
    const paymentData: PaymentData = {
      orderId: orderId,
      transactionId: null,
      status: PaymentStatus.Unpaid,
      amount: data.amount_total,
    };

    try {
      await this.prisma.$transaction(async () => {
        await this.ordersService.getOrder(orderId);
        await this.ordersService.revertOrderStocks(orderId);
        await this.ordersService.updateStatus(orderId, OrderStatus.Expired);
        await this.paymentService.createOrUpdatePayment(paymentData);
      });

      await this.emailService.sendOrderStatusUpdate(
        orderId,
        OrderStatus.Expired,
        data.customer_details.email,
      );

      console.warn(
        `Order #[${orderId}] expired and expiration email added to the queue.`,
      );
    } catch (error) {
      console.error(
        `Failed to process 'payment_expired' for Order ID ${orderId}:`,
        error,
      );
      throw new Error(
        `Payment expiration handling failed for Order ${orderId}.`,
      );
    }
  }

  private async paymentSuccessful(data: StripeSessionData): Promise<void> {
    const orderId = this.parseOrderId(data.metadata);

    const shippingDetails: ShippingCustomerDetails = {
      email: data.customer_details.email,
      address: {
        country: data.customer_details.address.country,
        state: data.customer_details.address.state,
        city: data.customer_details.address.city,
        postalCode: data.customer_details.address.postal_code,
        line1: data.customer_details.address.line1,
        line2: data.customer_details.address.line2,
      },
    };

    const paymentData: PaymentData = {
      orderId: orderId,
      transactionId: data.payment_intent,
      status: PaymentStatus.Paid,
      amount: data.amount_total,
    };

    try {
      const { existingOrder } = await this.prisma.$transaction(async () => {
        const existingOrder = await this.ordersService.getOrder(orderId);

        const updatedOrder = await this.ordersService.updateStatus(
          orderId,
          OrderStatus.Complete,
        );

        const shipping = await this.shippingService.createShipping(
          orderId,
          shippingDetails,
        );

        const payment =
          await this.paymentService.createOrUpdatePayment(paymentData);

        return { existingOrder, updatedOrder, shipping, payment };
      });

      await this.emailService.sendOrderStatusUpdate(
        orderId,
        OrderStatus.Complete,
        data.customer_details.email,
      );

      if (existingOrder.status === 'canceled') {
        await this.tryRefund(orderId, data.payment_intent);
      }
      console.warn(
        `Order #[${orderId}] marked as complete and order confirmation email added to queue.`,
      );
    } catch (error) {
      console.error(
        `Failed to process 'payment_successful' for Order ID ${orderId}:`,
        error,
      );
      throw new Error(`Payment success handling failed for Order ${orderId}.`);
    }
  }

  private parseOrderId(metadata: any) {
    const orderId = parseInt(metadata?.orderId ?? '');
    if (isNaN(orderId)) {
      throw new Error(`Invalid or missing order ID: ${metadata?.orderId}`);
    }
    return orderId;
  }

  private async tryRefund(orderId: number, paymentIntent: string) {
    try {
      await this.stripeService.createRefundForPayment(paymentIntent!, {
        orderId,
      });
      console.warn(`Refund issued for previously canceled order: ${orderId}`);
    } catch (error) {
      console.error(`Refund failed for order ID ${orderId}:`, error);
    }
  }
}
