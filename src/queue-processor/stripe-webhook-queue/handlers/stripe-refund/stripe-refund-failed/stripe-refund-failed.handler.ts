import { Injectable } from '@nestjs/common';
import { StripeEvent } from 'src/common/enum/stripe-event.enum';
import Stripe from 'stripe';
import { RefundData } from 'src/common/types/refund-data.types';
import { RefundService } from 'src/refund/refund.service';
import { StripeRefundUpdateHandlerBase } from '../stripe-refund-update.handler.base';
import { RefundStatus } from 'src/common/enum/refund-status.enum';

@Injectable()
export class StripeRefundFailedHandler extends StripeRefundUpdateHandlerBase {
  eventType: StripeEvent = StripeEvent.RefundFailed;

  constructor(private readonly refundService: RefundService) {
    super();
  }

  protected async getRefund(refundId: string): Promise<RefundData | null> {
    return await this.refundService.find(refundId);
  }
  protected async updateRefund(
    refund: RefundData,
    eventData: Stripe.Refund,
  ): Promise<{ success: boolean; log: string | null }> {
    // update refund status and failure reason
    await this.refundService.update({
      refundId: refund.refundId,
      failureReason: eventData?.failure_reason || null,
      status: RefundStatus.RefundFailed,
    });
    return { success: true, log: null };
  }
}
