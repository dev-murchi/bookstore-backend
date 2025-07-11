import { Injectable } from '@nestjs/common';
import { PaymentStatus } from 'src/common/enum/payment-status.enum';
import { StripeEvent } from 'src/common/enum/stripe-event.enum';
import { PaymentData } from 'src/common/types/payment-data.interface';
import { StripeHandler } from 'src/common/types/stripe-handler.interface';

import { OrderPaymentService } from 'src/order-payment/order-payment.service';
import { OrderDTO } from 'src/common/dto/order.dto';
import Stripe from 'stripe';

@Injectable()
export class StripePaymentFailedHandler implements StripeHandler {
  readonly eventType: StripeEvent = StripeEvent.PaymentIntentFailed;
  constructor(private readonly orderPaymentService: OrderPaymentService) {}
  async handle(
    eventData: Stripe.PaymentIntent,
    order: OrderDTO,
  ): Promise<{ success: boolean; log: string | null }> {
    try {
      // extract transactionId
      const transactionId = eventData.id;
      if (!transactionId) {
        return {
          success: false,
          log: 'Missing transaction ID in Stripe event data.',
        };
      }

      // prepare payment data
      const paymentData: PaymentData = {
        orderId: order.id,
        transactionId: transactionId,
        status: PaymentStatus.Failed,
        amount: eventData.amount,
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
      return { success: true, log: null };
    } catch (error) {
      console.error(
        `Failed to handle StripePaymentFailedHandler event for Order ${order.id}. log:`,
        error,
      );

      throw new Error(
        `Failed to handle StripePaymentFailedHandler event for Order ${order.id}. An unexpected error occurred.`,
      );
    }
  }
}
