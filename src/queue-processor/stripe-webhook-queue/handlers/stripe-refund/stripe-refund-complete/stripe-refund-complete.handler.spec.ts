import { TestingModule, Test } from '@nestjs/testing';
import { StripeRefundCompleteHandler } from './stripe-refund-complete.handler';
import { RefundService } from '../../../../../refund/refund.service';
import { OrderDTO } from '../../../../../common/dto/order.dto';
import { RefundData } from '../../../../../common/types/refund-data.types';
import { StripeEvent } from '../../../../../common/enum/stripe-event.enum';
import { RefundStatus } from '../../../../../common/enum/refund-status.enum';
import Stripe from 'stripe';

const mockRefundService = {
  find: jest.fn(),
  update: jest.fn(),
};

const mockStripeRefundEvent = {
  id: 're_succeeded_456',
  object: 'refund',
  amount: 1000,
  currency: 'usd',
  payment_intent: 'pi_succeeded_def',
  status: 'succeeded',
  failure_reason: null,
} as Stripe.Refund;

const mockOrder = {
  id: 'order-uuid-1',
  payment: {
    transactionId: 'pi_succeeded_def',
  },
} as OrderDTO;

const initialMockRefundData: RefundData = {
  refundId: 're_succeeded_456',
  orderId: 'order-uuid-1',
  status: RefundStatus.RefundCreated,
  amount: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
  failureReason: null,
};

describe('StripeRefundCompleteHandler', () => {
  let handler: StripeRefundCompleteHandler;

  beforeEach(async () => {
    mockRefundService.find.mockReset();
    mockRefundService.update.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeRefundCompleteHandler,
        { provide: RefundService, useValue: mockRefundService },
      ],
    }).compile();

    handler = module.get<StripeRefundCompleteHandler>(
      StripeRefundCompleteHandler,
    );

    mockRefundService.find.mockResolvedValue({ ...initialMockRefundData });
    mockRefundService.update.mockResolvedValue(undefined);
  });

  it('should be defined and have the correct eventType', () => {
    expect(handler).toBeDefined();
    expect(handler.eventType).toBe(StripeEvent.RefundUpdated);
  });

  describe('handle method (end-to-end flow for this handler)', () => {
    it('should successfully handle a refund.updated event with status "succeeded" and complete the refund', async () => {
      const result = await handler.handle(mockStripeRefundEvent, mockOrder);

      expect(result).toEqual({ success: true, log: null });
      expect(mockRefundService.find).toHaveBeenCalledWith(
        mockStripeRefundEvent.id,
      );
      expect(mockRefundService.update).toHaveBeenCalledWith({
        refundId: mockStripeRefundEvent.id,
        status: RefundStatus.RefundComplete,
      });
    });

    it('should return success: false and log if eventData.status is not "succeeded"', async () => {
      const eventWithPendingStatus = {
        ...mockStripeRefundEvent,
        status: 'pending',
      } as Stripe.Refund;

      const result = await handler.handle(eventWithPendingStatus, mockOrder);

      expect(result).toEqual({
        success: false,
        log: `Refund update failed: Stripe event status is '${eventWithPendingStatus.status}' instead of 'succeeded'.`,
      });
      expect(mockRefundService.find).toHaveBeenCalledWith(
        eventWithPendingStatus.id,
      );
      expect(mockRefundService.update).not.toHaveBeenCalled();
    });

    it('should throw an error if refundService.update fails during completion', async () => {
      const serviceError = new Error('Database write error during completion');
      mockRefundService.update.mockRejectedValue(serviceError);

      await expect(
        handler.handle(mockStripeRefundEvent, mockOrder),
      ).rejects.toThrow(`Failed to handle Stripe ${handler.eventType} event.`);

      expect(mockRefundService.find).toHaveBeenCalledWith(
        mockStripeRefundEvent.id,
      );
      expect(mockRefundService.update).toHaveBeenCalledWith({
        refundId: mockStripeRefundEvent.id,
        status: RefundStatus.RefundComplete,
      });
    });

    // Inherited processRefund method validation checks
    it('should return success: false if refund is not found by getRefund', async () => {
      mockRefundService.find.mockResolvedValue(null);

      const result = await handler.handle(mockStripeRefundEvent, mockOrder);

      expect(result).toEqual({
        success: false,
        log: `Refund ${mockStripeRefundEvent.id} is not exists.`,
      });
      expect(mockRefundService.find).toHaveBeenCalledWith(
        mockStripeRefundEvent.id,
      );
      expect(mockRefundService.update).not.toHaveBeenCalled();
    });

    it('should return success: false if refund orderId mismatches order id', async () => {
      const mismatchedRefundData = {
        ...initialMockRefundData,
        orderId: 'order-uuid-different',
      };
      mockRefundService.find.mockResolvedValue(mismatchedRefundData);

      const result = await handler.handle(mockStripeRefundEvent, mockOrder);

      expect(result).toEqual({
        success: false,
        log: `Mismatched orderId for refund ${mismatchedRefundData.refundId}. Expected ${mismatchedRefundData.orderId}, got ${mockOrder.id}.`,
      });
      expect(mockRefundService.find).toHaveBeenCalledWith(
        mockStripeRefundEvent.id,
      );
      expect(mockRefundService.update).not.toHaveBeenCalled();
    });

    it('should return success: false if refund status is already RefundComplete (pre-check)', async () => {
      const alreadyCompletedRefundData = {
        ...initialMockRefundData,
        status: RefundStatus.RefundComplete,
      };
      mockRefundService.find.mockResolvedValue(alreadyCompletedRefundData);

      const result = await handler.handle(mockStripeRefundEvent, mockOrder);

      expect(result).toEqual({
        success: false,
        log: `Refund ${mockStripeRefundEvent.id} has already been completed, status cannot be updated.`,
      });
      expect(mockRefundService.find).toHaveBeenCalledWith(
        mockStripeRefundEvent.id,
      );
      expect(mockRefundService.update).not.toHaveBeenCalled();
    });

    it('should return success: false if refundId is missing (inherited validation)', async () => {
      const eventWithMissingId = { ...mockStripeRefundEvent, id: undefined };
      const result = await handler.handle(eventWithMissingId, mockOrder);
      expect(result).toEqual({
        success: false,
        log: 'Missing refundId from Stripe refund event.',
      });
      expect(mockRefundService.find).not.toHaveBeenCalled();
    });

    it('should return success: false if order has no payment (inherited validation)', async () => {
      const orderWithoutPayment = { ...mockOrder, payment: null };
      const result = await handler.handle(
        mockStripeRefundEvent,
        orderWithoutPayment,
      );
      expect(result).toEqual({
        success: false,
        log: `Order ${orderWithoutPayment.id} has no associated payment.`,
      });
      expect(mockRefundService.find).not.toHaveBeenCalled();
    });

    it('should return success: false if transactionId mismatched (inherited validation)', async () => {
      const orderWithMismatchedTransaction = {
        ...mockOrder,
        payment: { transactionId: 'incorrect_transaction_id' },
      } as OrderDTO;
      const result = await handler.handle(
        mockStripeRefundEvent,
        orderWithMismatchedTransaction,
      );
      expect(result).toEqual({
        success: false,
        log: `Mismatched transactionId for Order ${orderWithMismatchedTransaction.id}. Expected incorrect_transaction_id, got ${mockStripeRefundEvent.payment_intent}.`,
      });
      expect(mockRefundService.find).not.toHaveBeenCalled();
    });
  });
});
