import { Injectable } from '@nestjs/common';
import { StripeEvent } from 'src/common/enum/stripe-event.enum';
import { StripeRefundHandlerBase } from '../stripe-refund.handler.base';
import { OrderDTO } from 'src/common/dto/order.dto';
import Stripe from 'stripe';
import { RefundData } from 'src/common/types/refund-data.types';
import { RefundService } from 'src/refund/refund.service';

@Injectable()
export class StripeRefundCreatedHandler extends StripeRefundHandlerBase {
  eventType: StripeEvent = StripeEvent.RefundCreated;

  constructor(private readonly refundService: RefundService) {
    super();
  }

  protected async getRefund(refundId: string): Promise<RefundData | null> {
    return await this.refundService.find(refundId);
  }

  protected async processRefund(
    refundId: string,
    order: OrderDTO,
    eventData: Stripe.Refund,
  ): Promise<{ success: boolean; log: string | null }> {
    // refund should not be exist
    const refund = await this.getRefund(refundId);
    if (refund) {
      return {
        success: false,
        log: `Refund with ID '${refundId}' already exists. No new refund created.`,
      };
    }
    // create a refund
    await this.refundService.create({
      refundId,
      orderId: order.id,
      amount: eventData?.amount,
    });
    return { success: true, log: null };
  }
}
