import { OrderDTO } from '../../../../common/dto/order.dto';
import { StripeEvent } from '../../../../common/enum/stripe-event.enum';
import { RefundData } from '../../../../common/types/refund-data.types';
import { StripeHandler } from '../../../../common/types/stripe-handler.interface';
import Stripe from 'stripe';

export abstract class StripeRefundHandlerBase implements StripeHandler {
  eventType: StripeEvent;

  async handle(
    eventData: Stripe.Refund,
    order: OrderDTO,
  ): Promise<{ success: boolean; log: string | null }> {
    try {
      // extract refund id
      const refundId = eventData.id;
      if (!refundId) {
        return {
          success: false,
          log: 'Missing refundId from Stripe refund event.',
        };
      }

      // extract transaction id
      const transactionId =
        typeof eventData.payment_intent === 'string'
          ? eventData.payment_intent
          : (eventData.payment_intent?.id ?? null);
      if (!transactionId) {
        return {
          success: false,
          log: 'Missing or invalid payment_intent in Stripe refund event.',
        };
      }

      // order must have payment
      if (!order.payment) {
        return {
          success: false,
          log: `Order ${order.id} has no associated payment.`,
        };
      }

      // order payment transaction id must same with extracted transaction id
      if (order.payment.transactionId !== transactionId) {
        return {
          success: false,
          log: `Mismatched transactionId for Order ${order.id}. Expected ${order.payment.transactionId}, got ${transactionId}.`,
        };
      }

      return await this.processRefund(refundId, order, eventData);
    } catch (error) {
      console.error(
        `Failed to handle Stripe ${this.eventType} event. Error:`,
        error,
      );
      throw new Error(`Failed to handle Stripe ${this.eventType} event.`);
    }
  }

  protected abstract getRefund(refundId: string): Promise<RefundData | null>;

  protected abstract processRefund(
    refundId: string,
    order: OrderDTO,
    eventData: Stripe.Refund,
  ): Promise<{ success: boolean; log: string | null }>;
}
