import { OrderDTO } from 'src/common/dto/order.dto';
import { RefundStatus } from 'src/common/enum/refund-status.enum';
import { StripeEvent } from 'src/common/enum/stripe-event.enum';
import { RefundData } from 'src/common/types/refund-data.types';
import Stripe from 'stripe';
import { StripeRefundUpdateHandlerBase } from './stripe-refund-update.handler.base';

const mockGetRefund: jest.Mock<Promise<RefundData | null>> = jest.fn();
const mockUpdateRefund: jest.Mock<
  Promise<{ success: boolean; log: string | null }>
> = jest.fn();

const mockRefundEvent = {
  id: 're_123',
  object: 'refund',
  amount: 1000,
  currency: 'usd',
  payment_intent: 'pi_abc',
  status: 'succeeded',
} as Stripe.Refund;

const mockRefundData: RefundData = {
  refundId: 're_123',
  orderId: 'order-uuid-1',
  status: RefundStatus.RefundFailed,
  amount: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
  failureReason: null,
};

const mockOrder = {
  id: 'order-uuid-1',
  payment: {
    transactionId: 'pi_abc',
  },
} as OrderDTO;

class MockStripeRefundUpdateHandlerTestClass extends StripeRefundUpdateHandlerBase {
  eventType: StripeEvent = StripeEvent.RefundUpdated;

  constructor() {
    super();
  }

  protected async getRefund(refundId: string): Promise<RefundData | null> {
    return mockGetRefund(refundId);
  }

  protected async updateRefund(
    refund: RefundData,
    eventData: Stripe.Refund,
  ): Promise<{ success: boolean; log: string | null }> {
    return mockUpdateRefund(refund, eventData);
  }
}

describe('StripeRefundUpdateHandlerBase', () => {
  let handler: MockStripeRefundUpdateHandlerTestClass;

  beforeEach(() => {
    handler = new MockStripeRefundUpdateHandlerTestClass();
    mockGetRefund.mockReset();
    mockUpdateRefund.mockReset();
  });

  describe('handle', () => {
    it('should call processRefund from the base class handle method', async () => {
      mockGetRefund.mockResolvedValue(mockRefundData);
      mockUpdateRefund.mockResolvedValue({ success: true, log: null });

      const result = await handler.handle(mockRefundEvent, mockOrder);

      expect(result).toEqual({ success: true, log: null });
      expect(mockUpdateRefund).toHaveBeenCalledTimes(1);
      expect(mockGetRefund).toHaveBeenCalledWith('re_123');
    });
  });

  describe('processRefund', () => {
    it('should successfully update the refund if all checks pass', async () => {
      mockGetRefund.mockResolvedValue(mockRefundData);
      mockUpdateRefund.mockResolvedValue({ success: true, log: null });

      const result = await handler['processRefund'](
        mockRefundEvent.id!,
        mockOrder,
        mockRefundEvent,
      );

      expect(result).toEqual({ success: true, log: null });

      expect(mockGetRefund).toHaveBeenCalledWith('re_123');
      expect(mockUpdateRefund).toHaveBeenCalledWith(
        mockRefundData,
        mockRefundEvent,
      );
    });

    it('should return success: false and log if refund is not found', async () => {
      mockGetRefund.mockResolvedValue(null);

      const result = await handler['processRefund'](
        mockRefundEvent.id!,
        mockOrder,
        mockRefundEvent,
      );

      expect(result).toEqual({
        success: false,
        log: `Refund ${mockRefundEvent.id} is not exists.`,
      });
      expect(mockGetRefund).toHaveBeenCalledWith('re_123');
      expect(mockUpdateRefund).not.toHaveBeenCalled();
    });

    it('should return success: false and log if refund orderId mismatches order id', async () => {
      const refundData = { ...mockRefundData, orderId: 'order-uuid-xyz' }; // Mismatch
      mockGetRefund.mockResolvedValue(refundData);

      const result = await handler['processRefund'](
        mockRefundEvent.id!,
        mockOrder,
        mockRefundEvent,
      );

      expect(result).toEqual({
        success: false,
        log: `Mismatched orderId for refund ${refundData.refundId}. Expected ${refundData.orderId}, got ${mockOrder.id}.`,
      });
      expect(mockGetRefund).toHaveBeenCalledWith('re_123');
      expect(mockUpdateRefund).not.toHaveBeenCalled();
    });

    it('should return success: false and log if refund status is RefundComplete', async () => {
      const refundData = {
        ...mockRefundData,
        status: RefundStatus.RefundComplete,
      };
      mockGetRefund.mockResolvedValue(refundData);

      const result = await handler['processRefund'](
        mockRefundEvent.id!,
        mockOrder,
        mockRefundEvent,
      );

      expect(result).toEqual({
        success: false,
        log: `Refund ${mockRefundEvent.id} has already been completed, status cannot be updated.`,
      });
      expect(mockGetRefund).toHaveBeenCalledWith('re_123');
      expect(mockUpdateRefund).not.toHaveBeenCalled();
    });

    it('should propagate the result from updateRefund if updateRefund returns success: false', async () => {
      mockGetRefund.mockResolvedValue(mockRefundData);
      mockUpdateRefund.mockResolvedValue({
        success: false,
        log: 'Failed to update',
      });

      const result = await handler['processRefund'](
        mockRefundEvent.id!,
        mockOrder,
        mockRefundEvent,
      );

      expect(result).toEqual({
        success: false,
        log: 'Failed to update',
      });
      expect(mockGetRefund).toHaveBeenCalledWith('re_123');
      expect(mockUpdateRefund).toHaveBeenCalledTimes(1);
    });

    // Note: The top-level 'handle' method catches and re-throws with a generic message.
    // For this test, we are assuming 'processRefund' itself might throw an error before 'handle' catches it.

    it('should propagate error if updateRefund throws an error', async () => {
      const errorMessage = 'Database connection error';
      mockGetRefund.mockResolvedValue(mockRefundData);
      mockUpdateRefund.mockRejectedValue(new Error(errorMessage));

      await expect(
        handler['processRefund'](
          mockRefundEvent.id!,
          mockOrder,
          mockRefundEvent,
        ),
      ).rejects.toThrow(errorMessage);

      expect(mockGetRefund).toHaveBeenCalledWith('re_123');
      expect(mockUpdateRefund).toHaveBeenCalledTimes(1);
    });
  });
});
