import { Test, TestingModule } from '@nestjs/testing';
import { StripeCheckoutExpired } from './stripe-checkout-expired.handler';
import { OrdersService } from '../../../../orders/orders.service';
import { OrderPaymentService } from '../../../../order-payment/order-payment.service';
import { StripeEvent } from '../../../../common/enum/stripe-event.enum';
import { OrderDTO } from '../../../../common/dto/order.dto';
import { OrderStatus } from '../../../../common/enum/order-status.enum';
import { PaymentStatus } from '../../../../common/enum/payment-status.enum';
import Stripe from 'stripe';

const mockOrdersService = {
  updateStatus: jest.fn(),
  revertOrderStocks: jest.fn(),
};
const mockOrderPaymentService = {
  update: jest.fn(),
};

const mockOrderWithoutPayment = {
  id: 'order-uuid-1',
  status: OrderStatus.Pending,
  payment: undefined,
} as OrderDTO;

const mockOrderWithPayment = {
  id: 'order-uuid-2',
  status: OrderStatus.Pending,
  payment: {
    id: 'payment-uuid-1',
    transactionId: 'txn-1234',
  },
} as OrderDTO;
describe('StripeCheckoutExpired', () => {
  let provider: StripeCheckoutExpired;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeCheckoutExpired,
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: OrderPaymentService, useValue: mockOrderPaymentService },
      ],
    }).compile();

    provider = module.get<StripeCheckoutExpired>(StripeCheckoutExpired);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should have an event type as StripeEvent.CheckoutSessionExpired', () => {
    expect(provider.eventType).toBe(StripeEvent.CheckoutSessionExpired);
  });

  describe('handle', () => {
    it('should return success false and an error message when the given order status is not PENDING', async () => {
      const eventData = {
        id: 'txn-9999',
        amount: 100,
      } as unknown as Stripe.Checkout.Session;
      const order = {
        ...mockOrderWithPayment,
        status: OrderStatus.Complete,
      };

      const result = await provider.handle(eventData, order);

      expect(result).toEqual({
        success: false,
        log: `Order ${order.id} must have a status of ${OrderStatus.Pending}, but found ${order.status}`,
      });
    });

    it('should return success false and an error message when the given order has not any payment but transactionId is exist', async () => {
      const eventData = {
        payment_intent: 'txn-9999',
        amount_total: 100,
      } as unknown as Stripe.Checkout.Session;

      const order = { ...mockOrderWithoutPayment };
      const result = await provider.handle(eventData, order);
      expect(result).toEqual({
        success: false,
        log: `No payment record found for Order ${order.id}, but transactionId (${eventData.payment_intent}) was provided.`,
      });
    });

    it('should return success false and an error message when the given order has a payment with a different transactionId', async () => {
      const eventData = {
        payment_intent: 'txn-9999',
        amount_total: 100,
      } as unknown as Stripe.Checkout.Session;

      const order = { ...mockOrderWithPayment };
      const result = await provider.handle(eventData, order);
      expect(result).toEqual({
        success: false,
        log: `Order ${order.id} has an existing payment with a different transaction ID.`,
      });
    });

    it('should handle when the given order has a payment', async () => {
      const eventData = {
        payment_intent: mockOrderWithPayment.payment.transactionId,
        amount_total: 100,
      } as unknown as Stripe.Checkout.Session;

      const order = { ...mockOrderWithPayment };
      const paymentData = {
        transactionId: eventData.payment_intent,
        orderId: order.id,
        status: PaymentStatus.Unpaid,
        amount: eventData.amount_total,
      };

      const result = await provider.handle(eventData, order);
      expect(result).toEqual({ success: true, log: null });
      expect(mockOrderPaymentService.update).toHaveBeenCalledWith(paymentData);
      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
        order.id,
        OrderStatus.Expired,
      );
      expect(mockOrdersService.revertOrderStocks).toHaveBeenCalledWith(
        order.id,
      );
    });
    it('should handle when the given order has no payment', async () => {
      const eventData = {
        payment_intent: null,
        amount_total: 100,
      } as unknown as Stripe.Checkout.Session;

      const order = { ...mockOrderWithoutPayment };

      const result = await provider.handle(eventData, order);
      expect(result).toEqual({ success: true, log: null });
      expect(mockOrderPaymentService.update).toHaveBeenCalledTimes(0);
      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
        order.id,
        OrderStatus.Expired,
      );
      expect(mockOrdersService.revertOrderStocks).toHaveBeenCalledWith(
        order.id,
      );
    });
    it('should catch unexpected errors and throw a new error', async () => {
      const eventData = {
        payment_intent: null,
        amount_total: 100,
      } as unknown as Stripe.Checkout.Session;

      const order = { ...mockOrderWithoutPayment };
      mockOrdersService.updateStatus.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(provider.handle(eventData, order)).rejects.toThrow(
        `Failed to handle StripeCheckoutExpired event for Order ${order.id}. An unexpected error occurred.`,
      );
    });
  });
});
