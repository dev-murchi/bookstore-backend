import { Injectable } from '@nestjs/common';
import { StripeEvent } from '../../../../common/enum/stripe-event.enum';
import { StripeHandler } from '../../../../common/types/stripe-handler.interface';
import { OrdersService } from '../../../../orders/orders.service';
import { OrderStatus } from '../../../../common/enum/order-status.enum';
import { OrderPaymentService } from '../../../../order-payment/order-payment.service';
import { PaymentStatus } from '../../../../common/enum/payment-status.enum';
import { OrderDTO } from '../../../../common/dto/order.dto';
import Stripe from 'stripe';

@Injectable()
export class StripeCheckoutExpired implements StripeHandler {
  eventType = StripeEvent.CheckoutSessionExpired;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderPaymentService: OrderPaymentService,
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

      // check order status
      if (order.status !== OrderStatus.Pending) {
        return {
          success: false,
          log: `Order ${order.id} must have a status of ${OrderStatus.Pending}, but found ${order.status}`,
        };
      }

      if (!order.payment && transactionId) {
        return {
          success: false,
          log: `No payment record found for Order ${order.id}, but transactionId (${transactionId}) was provided.`,
        };
      }

      // update order payment
      if (order.payment) {
        if (order.payment.transactionId !== transactionId) {
          return {
            success: false,
            log: `Order ${order.id} has an existing payment with a different transaction ID.`,
          };
        }

        await this.orderPaymentService.update({
          transactionId,
          orderId: order.id,
          status: PaymentStatus.Unpaid,
          amount: eventData.amount_total,
        });
      }

      // update order status
      await this.ordersService.updateStatus(order.id, OrderStatus.Expired);

      // revert stocks
      await this.ordersService.revertOrderStocks(order.id);

      return { success: true, log: null };
    } catch (error) {
      console.error(
        `Failed to handle StripeCheckoutExpired event for Order ${order.id}. log:`,
        error,
      );

      throw new Error(
        `Failed to handle StripeCheckoutExpired event for Order ${order.id}. An unexpected error occurred.`,
      );
    }
  }
}
