import { OrderDTO } from '../../../../common/dto/order.dto';
import { RefundData } from '../../../../common/types/refund-data.types';
import Stripe from 'stripe';
import { StripeRefundHandlerBase } from './stripe-refund.handler.base';
import { StripeEvent } from '../../../../common/enum/stripe-event.enum';
import { RefundStatus } from '../../../../common/enum/refund-status.enum';

export abstract class StripeRefundUpdateHandlerBase extends StripeRefundHandlerBase {
  eventType: StripeEvent;

  protected async processRefund(
    refundId: string,
    order: OrderDTO,
    eventData: Stripe.Refund,
  ): Promise<{ success: boolean; log: string | null }> {
    // refund must be exist
    const refund = await this.getRefund(refundId);

    if (!refund) {
      return {
        success: false,
        log: `Refund ${refundId} is not exists.`,
      };
    }

    // refund orderId must be same with order id
    if (refund.orderId !== order.id) {
      return {
        success: false,
        log: `Mismatched orderId for refund ${refund.refundId}. Expected ${refund.orderId}, got ${order.id}.`,
      };
    }

    // refund status must be different than RefundSatus.RefundCompleted
    if (refund.status === RefundStatus.RefundComplete) {
      return {
        success: false,
        log: `Refund ${refundId} has already been completed, status cannot be updated.`,
      };
    }

    // update the refund
    return await this.updateRefund(refund, eventData);
  }
  protected abstract updateRefund(
    refund: RefundData,
    eventData: Stripe.Refund,
  ): Promise<{ success: boolean; log: string | null }>;
}
