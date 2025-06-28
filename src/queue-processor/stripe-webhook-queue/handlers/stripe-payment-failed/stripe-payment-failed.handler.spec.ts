import { Test, TestingModule } from '@nestjs/testing';
import { StripePaymentFailed } from './stripe-payment-failed.handler';
import { OrderPaymentService } from '../../../../order-payment/order-payment.service';
import { StripeEvent } from '../../../../common/enum/stripe-event.enum';
import { OrderDTO } from '../../../../common/dto/order.dto';
import { PaymentStatus } from '../../../../common/enum/payment-status.enum';
import Stripe from 'stripe';

const mockOrderPaymentService = {
  create: jest.fn(),
  update: jest.fn(),
};
const mockOrderWithoutPayment = {
  id: 'order-uuid-1',
} as OrderDTO;

const mockOrderWithPayment = {
  id: 'order-uuid-2',
  payment: {
    id: 'payment-uuid-1',
    transactionId: 'txn-1234',
  },
} as OrderDTO;

describe('StripePaymentFailed', () => {
  let provider: StripePaymentFailed;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripePaymentFailed,
        { provide: OrderPaymentService, useValue: mockOrderPaymentService },
      ],
    }).compile();

    provider = module.get<StripePaymentFailed>(StripePaymentFailed);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should have an event type as StripeEvent.PaymentIntentFailed', () => {
    expect(provider.eventType).toBe(StripeEvent.PaymentIntentFailed);
  });

  describe('handle', () => {
    it('should return success false and an error message when the id is missing from event data', async () => {
      const eventData = {
        id: undefined,
        amount: 100,
      } as unknown as Stripe.PaymentIntent;

      const result = await provider.handle(eventData, mockOrderWithoutPayment);
      expect(result).toEqual({
        success: false,
        log: 'Missing transaction ID in Stripe event data.',
      });
    });

    it('should return success false and an error message when the given order has a payment with a different transactionId', async () => {
      const eventData = {
        id: 'txn-9999',
        amount: 100,
      } as unknown as Stripe.PaymentIntent;
      const order = { ...mockOrderWithPayment };
      const result = await provider.handle(eventData, order);
      expect(result).toEqual({
        success: false,
        log: `Order ${order.id} has an existing payment with a different transaction ID.`,
      });
    });

    it('should update the order payment', async () => {
      const eventData = {
        id: mockOrderWithPayment.payment.transactionId,
        amount: 100,
      } as unknown as Stripe.PaymentIntent;
      const order = { ...mockOrderWithPayment };
      const result = await provider.handle(eventData, order);
      expect(result).toEqual({ success: true, log: null });
      expect(mockOrderPaymentService.update).toHaveBeenCalledWith({
        orderId: order.id,
        transactionId: eventData.id,
        status: PaymentStatus.Failed,
        amount: eventData.amount,
      });
    });
    it('should create an order payment for the given order', async () => {
      const eventData = {
        id: 'txn-9999',
        amount: 100,
      } as unknown as Stripe.PaymentIntent;
      const order = { ...mockOrderWithoutPayment };
      const result = await provider.handle(eventData, order);
      expect(result).toEqual({ success: true, log: null });
      expect(mockOrderPaymentService.create).toHaveBeenCalledWith({
        orderId: order.id,
        transactionId: eventData.id,
        status: PaymentStatus.Failed,
        amount: eventData.amount,
      });
    });
    it('should catch unexpected errors and throw a new error', async () => {
      const eventData = {
        id: 'txn-9999',
        amount: 100,
      } as unknown as Stripe.PaymentIntent;
      const order = { ...mockOrderWithoutPayment };
      mockOrderPaymentService.create.mockRejectedValueOnce(
        new Error('DB Error'),
      );
      await expect(provider.handle(eventData, order)).rejects.toThrow(
        `Failed to handle StripePaymentFailed event for Order ${order.id}. An unexpected error occurred.`,
      );
    });
  });
});
