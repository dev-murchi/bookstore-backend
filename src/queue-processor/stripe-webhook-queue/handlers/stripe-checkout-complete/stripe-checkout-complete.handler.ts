import { Injectable } from '@nestjs/common';
import { StripeEvent } from '../../../../common/enum/stripe-event.enum';
import { StripeHandler } from '../../../../common/types/stripe-handler.interface';
import { OrdersService } from '../../../../orders/orders.service';
import { OrderStatus } from '../../../../common/enum/order-status.enum';
import { OrderPaymentService } from '../../../../order-payment/order-payment.service';
import { PaymentStatus } from '../../../../common/enum/payment-status.enum';
import { ShippingService } from '../../../../orders/shipping/shipping.service';
import { OrderDTO } from '../../../../common/dto/order.dto';
import { PaymentData } from '../../../../common/types/payment-data.interface';
import Stripe from 'stripe';

@Injectable()
export class StripeCheckoutComplete implements StripeHandler {
  eventType = StripeEvent.CheckoutSessionCompleted;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly shippingService: ShippingService,
  ) {}

  async handle(
    eventData: Stripe.Checkout.Session,
    order: OrderDTO,
  ): Promise<{ success: boolean; log: string | null }> {
    try {
      // extract transactionId
      const transactionId =
        typeof eventData.payment_intent === 'string'
          ? eventData.payment_intent
          : (eventData.payment_intent?.id ?? null);

      if (!transactionId) {
        return {
          success: false,
          log: 'Missing transaction ID in Stripe event data.',
        };
      }

      // extract customer details
      const customerDetails = eventData.customer_details;
      if (!customerDetails) {
        return {
          success: false,
          log: 'Missing customer shipping informations in Stripe event data.',
        };
      }

      // check order status
      if (order.status !== OrderStatus.Pending) {
        return {
          success: false,
          log: `Order ${order.id} must have a status of ${OrderStatus.Pending}, but found ${order.status}`,
        };
      }

      // prepare payment data
      const paymentData: PaymentData = {
        transactionId,
        orderId: order.id,
        status: PaymentStatus.Paid,
        amount: eventData.amount_total,
      };

      // create/update order payment
      if (order.payment) {
        if (order.payment.transactionId !== transactionId) {
          return {
            success: false,
            log: `Order ${order.id} has an existing payment with a different transaction ID.`,
          };
        }

        await this.orderPaymentService.update(paymentData);
      } else {
        await this.orderPaymentService.create(paymentData);
      }

      // update order status
      await this.ordersService.updateStatus(order.id, OrderStatus.Complete);
      // create shipping
      await this.shippingService.createShipping(order.id, {
        email: customerDetails.email,
        name: customerDetails.name,
        address: {
          country: customerDetails.address.country,
          state: customerDetails.address.state,
          city: customerDetails.address.city,
          line1: customerDetails.address.line1,
          postalCode: customerDetails.address.postal_code,
          line2: customerDetails.address.line2 ?? null,
        },
      });

      // handle guest checkout
      if (!order.owner) {
        // extract and trim the guest's email and name
        const guestEmail = eventData.customer_details.email?.trim() || null;
        const guestName = eventData.customer_details.name?.trim() || null;

        // assign guest to order if email is available
        if (guestEmail) {
          await this.ordersService.assignGuestToOrder(
            order.id,
            guestEmail,
            guestName,
          );
        } else {
          console.info(`Guest email is missing for Order: ${order.id}`);
        }
      }

      return { success: true, log: null };
    } catch (error) {
      console.error(
        `Failed to handle StripeCheckoutComplete event for Order ${order.id}. log:`,
        error,
      );

      throw new Error(
        `Failed to handle StripeCheckoutComplete event for Order ${order.id}. An unexpected error occurred.`,
      );
    }
  }
}
