import { Injectable } from '@nestjs/common';
import { StripeEvent } from '../../../../../common/enum/stripe-event.enum';

import Stripe from 'stripe';
import { RefundData } from '../../../../../common/types/refund-data.types';
import { RefundService } from '../../../../../refund/refund.service';
import { StripeRefundUpdateHandlerBase } from '../stripe-refund-update.handler.base';
import { RefundStatus } from '../../../../../common/enum/refund-status.enum';

@Injectable()
export class StripeRefundCompleteHandler extends StripeRefundUpdateHandlerBase {
  eventType: StripeEvent = StripeEvent.RefundUpdated;

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
    // event data status must be "succeeded"
    if (eventData?.status === 'succeeded') {
      // update refund status
      await this.refundService.update({
        refundId: refund.refundId,
        status: RefundStatus.RefundComplete,
      });
      return { success: true, log: null };
    } else {
      return {
        success: false,
        log: `Refund update failed: Stripe event status is '${eventData?.status}' instead of 'succeeded'.`,
      };
    }
  }
}
