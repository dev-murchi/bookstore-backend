import { OrderDTO } from 'src/common/dto/order.dto';
import { RefundData } from 'src/common/types/refund-data.types';
import Stripe from 'stripe';
import { StripeRefundHandlerBase } from './stripe-refund.handler.base';
import { StripeEvent } from 'src/common/enum/stripe-event.enum';

const mockOrder = {
  id: 'order-uuid-1',
  payment: {
    transactionId: 'pi_abc',
  },
} as OrderDTO;

const mockRefundEvent = {
  id: 're_123',
  object: 'refund',
  amount: 1000,
  currency: 'usd',
  payment_intent: 'pi_abc',
  status: 'succeeded',
} as Stripe.Refund;

const mockGetRefund: jest.Mock<Promise<RefundData | null>> = jest.fn();
const mockProcessRefund: jest.Mock<
  Promise<{ success: boolean; log: string | null }>
> = jest.fn();

class MockStripeRefundHandlerTestClass extends StripeRefundHandlerBase {
  eventType: StripeEvent = StripeEvent.RefundCreated;

  constructor() {
    super();
  }

  protected async getRefund(refundId: string): Promise<RefundData | null> {
    return mockGetRefund(refundId);
  }

  protected async processRefund(
    refundId: string,
    order: OrderDTO,
    eventData: Stripe.Refund,
  ): Promise<{ success: boolean; log: string | null }> {
    return mockProcessRefund(refundId, order, eventData);
  }
}

describe('StripeRefundHandlerBase', () => {
  let handler: MockStripeRefundHandlerTestClass;

  beforeEach(() => {
    handler = new MockStripeRefundHandlerTestClass();
    mockGetRefund.mockReset();
    mockProcessRefund.mockReset();
  });

  it('should successfully handle a valid refund event', async () => {
    mockProcessRefund.mockResolvedValue({ success: true, log: null });

    const result = await handler.handle(mockRefundEvent, mockOrder);

    expect(result).toEqual({
      success: true,
      log: null,
    });

    expect(mockProcessRefund).toHaveBeenCalledWith(
      're_123',
      mockOrder,
      mockRefundEvent,
    );
  });

  it('should return success: false and log if refundId is missing', async () => {
    const eventData = { ...mockRefundEvent, id: undefined };

    const result = await handler.handle(eventData, mockOrder);

    expect(result).toEqual({
      success: false,
      log: 'Missing refundId from Stripe refund event.',
    });
    expect(mockProcessRefund).not.toHaveBeenCalled();
  });

  it('should return success: false and log if payment_intent is missing', async () => {
    const eventData = { ...mockRefundEvent, payment_intent: '' };
    const result = await handler.handle(eventData, mockOrder);

    expect(result).toEqual({
      success: false,
      log: 'Missing or invalid payment_intent in Stripe refund event.',
    });
    expect(mockProcessRefund).not.toHaveBeenCalled();
  });

  it('should return success: false and log if payment_intent is an object without an id', async () => {
    const eventData = { ...mockRefundEvent, payment_intent: null };
    const result = await handler.handle(eventData, mockOrder);

    expect(result).toEqual({
      success: false,
      log: 'Missing or invalid payment_intent in Stripe refund event.',
    });
    expect(mockProcessRefund).not.toHaveBeenCalled();
  });

  it('should return success: false and log if order has no associated payment', async () => {
    const order = { ...mockOrder, payment: null };

    const result = await handler.handle(mockRefundEvent, order);

    expect(result).toEqual({
      success: false,
      log: `Order ${mockOrder.id} has no associated payment.`,
    });
    expect(mockProcessRefund).not.toHaveBeenCalled();
  });

  it('should return success: false and log if transactionId mismatched', async () => {
    const order = {
      ...mockOrder,
      payment: { ...mockOrder.payment, transactionId: 'pi_xyz' }, // Mismatch
    };
    const result = await handler.handle(mockRefundEvent, order);

    expect(result).toEqual({
      success: false,
      log: `Mismatched transactionId for Order ${mockOrder.id}. Expected pi_xyz, got pi_abc.`,
    });
    expect(mockProcessRefund).not.toHaveBeenCalled();
  });

  it('should propagate error if processRefund throws an error', async () => {
    const errorMessage = 'Something went wrong during processing';
    mockProcessRefund.mockRejectedValue(new Error(errorMessage));

    await expect(handler.handle(mockRefundEvent, mockOrder)).rejects.toThrow(
      `Failed to handle Stripe ${handler.eventType} event.`,
    );
    expect(mockProcessRefund).toHaveBeenCalledTimes(1);
  });
});
