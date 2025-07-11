import { Test, TestingModule } from '@nestjs/testing';
import { StripeCheckoutExpiredHandler } from './stripe-checkout-expired.handler';
import { OrdersService } from 'src/orders/orders.service';
import { OrderPaymentService } from 'src/order-payment/order-payment.service';
import { StripeEvent } from 'src/common/enum/stripe-event.enum';
import { OrderDTO } from 'src/common/dto/order.dto';
import { OrderStatus } from 'src/common/enum/order-status.enum';
import { PaymentStatus } from 'src/common/enum/payment-status.enum';
import Stripe from 'stripe';

const mockOrdersService = {
  updateStatus: jest.fn(),
  revertOrderStocks: jest.fn(),
  assignGuestToOrder: jest.fn(),
};
const mockOrderPaymentService = {
  update: jest.fn(),
};

const mockOrderWithoutPayment = {
  id: 'order-uuid-1',
  status: OrderStatus.Pending,
  payment: undefined,
  owner: {
    id: 'user-uuid-1',
    name: 'test user',
    email: 'testuser@email.com',
  },
} as OrderDTO;

const mockOrderWithPayment = {
  id: 'order-uuid-2',
  status: OrderStatus.Pending,
  payment: {
    id: 'payment-uuid-1',
    transactionId: 'txn-1234',
  },
  owner: {
    id: 'user-uuid-1',
    name: 'test user',
    email: 'testuser@email.com',
  },
} as OrderDTO;

const mockGuestOrder = {
  id: 'order-uuid-guest',
  status: OrderStatus.Pending,
  payment: undefined,
  owner: null,
} as OrderDTO;

describe('StripeCheckoutExpiredHandler', () => {
  let provider: StripeCheckoutExpiredHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeCheckoutExpiredHandler,
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: OrderPaymentService, useValue: mockOrderPaymentService },
      ],
    }).compile();

    provider = module.get<StripeCheckoutExpiredHandler>(
      StripeCheckoutExpiredHandler,
    );
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

    it('should handle when the given order has a payment for the registered user', async () => {
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
    it('should handle when the given order has no payment for the registered user', async () => {
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
        `Failed to handle StripeCheckoutExpiredHandler event for Order ${order.id}. An unexpected error occurred.`,
      );
    });

    it('should not assign guest if customer details are missing', async () => {
      const eventData = {
        payment_intent: null,
        amount_total: 100,
        customer_details: null,
      } as unknown as Stripe.Checkout.Session;

      const order = { ...mockGuestOrder };

      const consoleSpy = jest
        .spyOn(console, 'info')
        .mockImplementation(() => {});

      const result = await provider.handle(eventData, order);

      expect(mockOrdersService.assignGuestToOrder).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        `Customer details are missing in event data for Order: ${order.id}`,
      );
      expect(result).toEqual({ success: true, log: null });

      consoleSpy.mockRestore();
    });

    it('should not assign guest if email is missing in customer details for the guest user', async () => {
      const eventData = {
        payment_intent: null,
        amount_total: 100,
        customer_details: {
          email: '   ', // empty after trimming
          name: 'guest user',
        },
      } as unknown as Stripe.Checkout.Session;

      const order = { ...mockGuestOrder };

      const consoleSpy = jest
        .spyOn(console, 'info')
        .mockImplementation(() => {});

      const result = await provider.handle(eventData, order);

      expect(mockOrdersService.assignGuestToOrder).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        `Guest email is missing for Order: ${order.id}`,
      );
      expect(result).toEqual({ success: true, log: null });

      consoleSpy.mockRestore();
    });

    it('should assign guest with trimmed email and name (or null if name empty) when customer details and email are provide for the guest user', async () => {
      const eventData = {
        payment_intent: null,
        amount_total: 100,
        customer_details: {
          email: ' guest@example.com ',
          name: ' guest user ',
        },
      } as unknown as Stripe.Checkout.Session;

      const order = { ...mockGuestOrder };

      // First case: with guest name
      const resultWithGuestName = await provider.handle(eventData, order);
      expect(mockOrdersService.assignGuestToOrder).toHaveBeenCalledWith(
        order.id,
        'guest@example.com',
        'guest user',
      );
      expect(resultWithGuestName).toEqual({ success: true, log: null });

      mockOrdersService.assignGuestToOrder.mockClear();

      // Second case: with empty guest name (should become null)
      const eventDataEmptyName = {
        ...eventData,
        customer_details: {
          ...eventData.customer_details,
          name: '    ', // empty whitespace name
        },
      };

      const resultEmptyGuestName = await provider.handle(
        eventDataEmptyName,
        order,
      );
      expect(mockOrdersService.assignGuestToOrder).toHaveBeenCalledWith(
        order.id,
        'guest@example.com',
        null,
      );
      expect(resultEmptyGuestName).toEqual({ success: true, log: null });
    });
  });
});
