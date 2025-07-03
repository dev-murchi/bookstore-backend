import { Test, TestingModule } from '@nestjs/testing';
import { StripeCheckoutCompleteHandler } from './stripe-checkout-complete.handler';
import { OrdersService } from '../../../../orders/orders.service';
import { OrderPaymentService } from '../../../../order-payment/order-payment.service';
import { ShippingService } from '../../../../orders/shipping/shipping.service';
import { OrderStatus } from '../../../../common/enum/order-status.enum';
import { OrderDTO } from '../../../../common/dto/order.dto';
import { StripeEvent } from '../../../../common/enum/stripe-event.enum';
import Stripe from 'stripe';
import { PaymentStatus } from '../../../../common/enum/payment-status.enum';

const mockOrdersService = {
  updateStatus: jest.fn(),
  assignGuestToOrder: jest.fn(),
};
const mockOrderPaymentService = {
  create: jest.fn(),
  update: jest.fn(),
};
const mockShippingService = {
  createShipping: jest.fn(),
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
describe('StripeCheckoutCompleteHandler', () => {
  let provider: StripeCheckoutCompleteHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeCheckoutCompleteHandler,
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: OrderPaymentService, useValue: mockOrderPaymentService },
        { provide: ShippingService, useValue: mockShippingService },
      ],
    }).compile();

    provider = module.get<StripeCheckoutCompleteHandler>(
      StripeCheckoutCompleteHandler,
    );
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should have an event type as StripeEvent.CheckoutSessionExpired', () => {
    expect(provider.eventType).toBe(StripeEvent.CheckoutSessionCompleted);
  });

  describe('handle', () => {
    it('should return success false and an error message when transactionId is null', async () => {
      const eventData = {
        payment_intent: undefined,
        amount_total: 100,
      } as unknown as Stripe.Checkout.Session;

      const result = await provider.handle(eventData, mockOrderWithoutPayment);
      expect(result).toEqual({
        success: false,
        log: 'Missing transaction ID in Stripe event data.',
      });
    });

    it('should return success false and an error message when shipping informations is not provided', async () => {
      const eventData = {
        payment_intent: 'txn-9999',
        amount_total: 100,
      } as unknown as Stripe.Checkout.Session;

      const result = await provider.handle(eventData, mockOrderWithoutPayment);
      expect(result).toEqual({
        success: false,
        log: 'Missing customer shipping informations in Stripe event data.',
      });
    });

    it('should return success false and an error message when the given order status is not PENDING', async () => {
      const eventData = {
        payment_intent: 'txn-9999',
        amount_total: 100,
        customer_details: {},
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

    it('should return success false and an error message when the given order has a payment with a different transactionId', async () => {
      const eventData = {
        payment_intent: 'txn-9999',
        amount_total: 100,
        customer_details: {},
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
        customer_details: {
          email: 'testuser@email.com',
          name: 'test user',
          address: {
            country: 'Test Country',
            state: 'Test State',
            city: 'Test City',
            line1: 'Test street',
            postalCode: 'TEST-001',
          },
        },
      } as unknown as Stripe.Checkout.Session;

      const order = { ...mockOrderWithPayment };
      const result = await provider.handle(eventData, order);
      expect(result).toEqual({ success: true, log: null });
      expect(mockOrderPaymentService.update).toHaveBeenLastCalledWith({
        transactionId: eventData.payment_intent,
        orderId: order.id,
        status: PaymentStatus.Paid,
        amount: eventData.amount_total,
      });
      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
        order.id,
        OrderStatus.Complete,
      );
      expect(mockShippingService.createShipping).toHaveBeenCalledWith(
        order.id,
        {
          name: eventData.customer_details.name,
          email: eventData.customer_details.email,
          address: {
            country: eventData.customer_details.address.country,
            state: eventData.customer_details.address.state,
            city: eventData.customer_details.address.city,
            line1: eventData.customer_details.address.line1,
            postalCode: eventData.customer_details.address.postal_code,
            line2: null,
          },
        },
      );
    });
    it('should handle when the given order has no payment for the registered user', async () => {
      const eventData = {
        payment_intent: 'txn-9999',
        amount_total: 100,
        customer_details: {
          email: 'testuser@email.com',
          name: 'test user',
          address: {
            country: 'Test Country',
            state: 'Test State',
            city: 'Test City',
            line1: 'Test street',
            postalCode: 'TEST-001',
            line2: 'Door num: 001',
          },
        },
      } as unknown as Stripe.Checkout.Session;

      const order = { ...mockOrderWithoutPayment };
      const result = await provider.handle(eventData, order);
      expect(result).toEqual({ success: true, log: null });
      expect(mockOrderPaymentService.create).toHaveBeenLastCalledWith({
        transactionId: eventData.payment_intent,
        orderId: order.id,
        status: PaymentStatus.Paid,
        amount: eventData.amount_total,
      });
      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
        order.id,
        OrderStatus.Complete,
      );
      expect(mockShippingService.createShipping).toHaveBeenCalledWith(
        order.id,
        {
          name: eventData.customer_details.name,
          email: eventData.customer_details.email,
          address: {
            country: eventData.customer_details.address.country,
            state: eventData.customer_details.address.state,
            city: eventData.customer_details.address.city,
            line1: eventData.customer_details.address.line1,
            postalCode: eventData.customer_details.address.postal_code,
            line2: eventData.customer_details.address.line2,
          },
        },
      );
    });
    it('should catch unexpected errors and throw a new error', async () => {
      const eventData = {
        payment_intent: 'txn-9999',
        amount_total: 100,
        customer_details: {
          email: 'testuser@email.com',
          name: 'test user',
          address: {
            country: 'Test Country',
            state: 'Test State',
            city: 'Test City',
            line1: 'Test street',
            postalCode: 'TEST-001',
            line2: 'Door num: 001',
          },
        },
      } as unknown as Stripe.Checkout.Session;

      const order = { ...mockOrderWithoutPayment };

      mockOrderPaymentService.create.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(provider.handle(eventData, order)).rejects.toThrow(
        `Failed to handle StripeCheckoutCompleteHandler event for Order ${order.id}. An unexpected error occurred.`,
      );
    });

    it('should not assign guest if email is missing in customer details for the guest user', async () => {
      const eventData = {
        payment_intent: 'txn-9999',
        amount_total: 100,
        customer_details: {
          email: '   ', // empty after trimming
          name: 'guest user',
          address: {
            country: 'Test Country',
            state: 'Test State',
            city: 'Test City',
            line1: 'Test street',
            postalCode: 'TEST-001',
            line2: 'Door num: 001',
          },
        },
      } as unknown as Stripe.Checkout.Session;

      const consoleSpy = jest
        .spyOn(console, 'info')
        .mockImplementation(() => {});

      const order = { ...mockOrderWithoutPayment, owner: null };
      const result = await provider.handle(eventData, order);
      expect(result).toEqual({ success: true, log: null });
      expect(mockOrdersService.assignGuestToOrder).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        `Guest email is missing for Order: ${order.id}`,
      );
      consoleSpy.mockRestore();
    });

    it('should assign guest with trimmed email and name (or null if name empty) when customer details and email are provide for the guest user', async () => {
      const eventData = {
        payment_intent: 'txn-9999',
        amount_total: 100,
        customer_details: {
          email: ' guest@example.com ',
          name: ' guest user ',
          address: {
            country: 'Test Country',
            state: 'Test State',
            city: 'Test City',
            line1: 'Test street',
            postalCode: 'TEST-001',
            line2: 'Door num: 001',
          },
        },
      } as unknown as Stripe.Checkout.Session;

      const consoleSpy = jest
        .spyOn(console, 'info')
        .mockImplementation(() => {});

      const order = { ...mockOrderWithoutPayment, owner: null };
      const resultWithGuestName = await provider.handle(eventData, order);
      expect(resultWithGuestName).toEqual({ success: true, log: null });
      expect(mockOrdersService.assignGuestToOrder).toHaveBeenCalledWith(
        order.id,
        'guest@example.com',
        'guest user',
      );

      mockOrdersService.assignGuestToOrder.mockClear();

      // Second case: with empty guest name (should become null)
      const eventDataEmptyName = {
        ...eventData,
        customer_details: {
          ...eventData.customer_details,
          name: '   ', // empty whitespace name
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
      consoleSpy.mockRestore();
    });
  });
});
