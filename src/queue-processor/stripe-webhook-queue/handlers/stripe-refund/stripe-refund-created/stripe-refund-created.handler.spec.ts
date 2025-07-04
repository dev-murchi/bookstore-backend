import { TestingModule, Test } from '@nestjs/testing';
import { StripeRefundCreatedHandler } from './stripe-refund-created.handler';
import { RefundService } from '../../../../../refund/refund.service';
import { OrderDTO } from '../../../../../common/dto/order.dto';
import { RefundData } from '../../../../../common/types/refund-data.types';
import { StripeEvent } from '../../../../../common/enum/stripe-event.enum';
import { RefundStatus } from '../../../../../common/enum/refund-status.enum';
import Stripe from 'stripe';

const mockRefundService = {
  find: jest.fn(),
  create: jest.fn(),
};

const mockStripeRefundEvent = {
  id: 're_created_789',
  object: 'refund',
  amount: 2500,
  currency: 'usd',
  payment_intent: 'pi_created_ghi',
  status: 'pending',
  failure_reason: null,
} as Stripe.Refund;

const mockOrder: OrderDTO = {
  id: 'order-uuid-1',
  payment: {
    transactionId: 'pi_created_ghi',
  },
} as OrderDTO;

const existingMockRefundData: RefundData = {
  refundId: 're_created_789',
  orderId: 'order-uuid-1',
  status: RefundStatus.RefundCreated,
  amount: 2500,
  createdAt: new Date(),
  updatedAt: new Date(),
  failureReason: null,
};

describe('StripeRefundCreatedHandler', () => {
  let handler: StripeRefundCreatedHandler;

  beforeEach(async () => {
    mockRefundService.find.mockReset();
    mockRefundService.create.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeRefundCreatedHandler,
        { provide: RefundService, useValue: mockRefundService },
      ],
    }).compile();

    handler = module.get<StripeRefundCreatedHandler>(
      StripeRefundCreatedHandler,
    );

    mockRefundService.find.mockResolvedValue(null);
    mockRefundService.create.mockResolvedValue(undefined);
  });

  it('should be defined and have the correct eventType', () => {
    expect(handler).toBeDefined();
    expect(handler.eventType).toBe(StripeEvent.RefundCreated);
  });

  describe('handle method (end-to-end flow for this handler)', () => {
    it('should successfully handle a refund.created event and create a new refund', async () => {
      const result = await handler.handle(mockStripeRefundEvent, mockOrder);

      expect(result).toEqual({ success: true, log: null });
      expect(mockRefundService.find).toHaveBeenCalledWith(
        mockStripeRefundEvent.id,
      );

      expect(mockRefundService.create).toHaveBeenCalledWith({
        refundId: mockStripeRefundEvent.id,
        orderId: mockOrder.id,
        amount: mockStripeRefundEvent.amount,
      });
    });

    it('should return success: false and empty log if refund already exists', async () => {
      mockRefundService.find.mockResolvedValue(existingMockRefundData);

      const result = await handler.handle(mockStripeRefundEvent, mockOrder);

      expect(result).toEqual({
        success: false,
        log: `Refund with ID '${mockStripeRefundEvent.id}' already exists. No new refund created.`,
      });

      expect(mockRefundService.find).toHaveBeenCalledWith(
        mockStripeRefundEvent.id,
      );
      expect(mockRefundService.create).not.toHaveBeenCalled();
    });

    it('should throw an error if refundService.create fails', async () => {
      const serviceError = new Error('Database write error during creation');
      mockRefundService.create.mockRejectedValue(serviceError);

      await expect(
        handler.handle(mockStripeRefundEvent, mockOrder),
      ).rejects.toThrow(`Failed to handle Stripe ${handler.eventType} event.`);

      expect(mockRefundService.find).toHaveBeenCalledWith(
        mockStripeRefundEvent.id,
      );
      expect(mockRefundService.create).toHaveBeenCalledWith({
        refundId: mockStripeRefundEvent.id,
        orderId: mockOrder.id,
        amount: mockStripeRefundEvent.amount,
      });
    });

    // --- Inherited handle method validation checks (from StripeRefundHandlerBase) ---
    it('should return success: false if refundId is missing (inherited validation)', async () => {
      const eventWithMissingId = { ...mockStripeRefundEvent, id: undefined };
      const result = await handler.handle(eventWithMissingId, mockOrder);
      expect(result).toEqual({
        success: false,
        log: 'Missing refundId from Stripe refund event.',
      });
      expect(mockRefundService.find).not.toHaveBeenCalled();
      expect(mockRefundService.create).not.toHaveBeenCalled();
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
      expect(mockRefundService.create).not.toHaveBeenCalled();
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
      expect(mockRefundService.create).not.toHaveBeenCalled();
    });
  });
});
