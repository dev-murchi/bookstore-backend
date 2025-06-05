import { Test, TestingModule } from '@nestjs/testing';
import {
  StripePaymentData,
  StripeSessionData,
  StripeWebhookProcessor,
} from './stripe-webhook-queue.processor';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../payment/stripe/stripe.service';
import { PaymentService } from '../payment/payment.service';
import { OrdersService } from '../orders/orders.service';
import { ShippingService } from '../orders/shipping/shipping.service';
import { PaymentStatus } from '../common/enum/payment-status.enum';
import { EmailService } from '../email/email.service';
import { OrderStatus } from '../common/enum/order-status.enum';

const mockPrismaService = {
  $transaction: jest.fn((fn) => fn()),
  payment: {
    upsert: jest.fn(),
  },
  orders: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  books: {
    update: jest.fn(),
  },
  shipping: {
    create: jest.fn(),
  },
};

const mockOrdersService = {
  getOrder: jest.fn(),
  revertOrderStocks: jest.fn(),
  updateStatus: jest.fn(),
};
const mockPaymentService = {
  createOrUpdatePayment: jest.fn(),
};
const mockShippingService = {
  createShipping: jest.fn(),
};

const mockStripeService = {
  createRefundForPayment: jest.fn(),
};

const mockEmailService = {
  sendOrderStatusChangeMail: jest.fn(),
};

describe('StripeWebhookProcessor', () => {
  let processor: StripeWebhookProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhookProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: ShippingService, useValue: mockShippingService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    processor = module.get<StripeWebhookProcessor>(StripeWebhookProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('paymentFailed', () => {
    it('should upsert payment with correct data', async () => {
      const data: StripePaymentData = {
        id: 'pi_123',
        object: 'payment_intent',
        amount: 1000,
        last_payment_error: {
          message: 'Your card has insufficient funds.',
        },
        metadata: { orderId: 'order-uuid-123' },
        status: 'requires_payment_method',
      };
      mockPaymentService.createOrUpdatePayment.mockResolvedValueOnce({});

      await (processor as any).paymentFailed(data);

      expect(mockPaymentService.createOrUpdatePayment).toHaveBeenCalledWith({
        orderId: 'order-uuid-123',
        transactionId: 'pi_123',
        status: PaymentStatus.Failed,
        amount: 1000,
      });
    });

    it('should throw errors gracefully', async () => {
      const data: StripePaymentData = {
        id: 'pi_123',
        metadata: { orderId: 'order-uuid-123' },
        last_payment_error: { message: 'Payment failed' },
        amount: 1000,
        object: 'payment_intent',
        status: 'requires_payment_method',
      };

      mockPaymentService.createOrUpdatePayment.mockRejectedValueOnce(
        new Error('Payment upsert error'),
      );

      await expect((processor as any).paymentFailed(data)).rejects.toThrow(
        new Error('Payment failure handling failed for Order order-uuid-123.'),
      );
    });
  });

  describe('paymentExpired', () => {
    it('should update order status as "expired" and update stock count of order items', async () => {
      const data: StripeSessionData = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: 'order-uuid-123' },
        amount_total: 1000,
        currency: 'usd',
        payment_status: 'unpaid',
        status: 'expired',
        customer_details: {
          address: {
            city: 'Test City',
            country: 'Test Country',
            line1: 'address line 1',
            line2: 'address line 2',
            postal_code: 'POSTAL_CODE',
            state: 'Test State',
          },
          email: 'user@email.com',
        },
      };

      const orderItems = [
        {
          id: 1,
          quantity: 1,
          book: {
            id: 1,
            title: 'Test Book 1',
            author: { name: 'Test Author One' },
          },
        },
        {
          id: 2,
          quantity: 2,
          book: {
            id: 2,
            title: 'Test Book 2',
            author: { name: 'Test Author Two' },
          },
        },
      ];

      const existingOrder = {
        order_items: orderItems,
        id: 1,
        orderid: 'order-uuid-123',
        status: 'pending',
        userid: 1,
        totalPrice: 1000,
        shipping_details: null,
      };

      mockOrdersService.getOrder.mockResolvedValueOnce(existingOrder);
      mockOrdersService.revertOrderStocks.mockResolvedValueOnce({});
      mockOrdersService.updateStatus.mockResolvedValueOnce({});
      mockPaymentService.createOrUpdatePayment.mockResolvedValueOnce({});

      const consoleSpy = jest.spyOn(console, 'warn');

      await (processor as any).paymentExpired(data);

      expect(mockOrdersService.getOrder).toHaveBeenCalledWith('order-uuid-123');
      expect(mockOrdersService.revertOrderStocks).toHaveBeenCalledWith(
        'order-uuid-123',
      );
      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
        'order-uuid-123',
        OrderStatus.Expired,
      );
      expect(mockPaymentService.createOrUpdatePayment).toHaveBeenCalledWith({
        orderId: 'order-uuid-123',
        transactionId: null,
        status: PaymentStatus.Unpaid,
        amount: 1000,
      });

      expect(mockEmailService.sendOrderStatusChangeMail).toHaveBeenCalledWith(
        OrderStatus.Expired,
        {
          orderId: 'order-uuid-123',
          username: 'user@email.com',
          email: 'user@email.com',
        },
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'Order #[order-uuid-123] expired and expiration email added to the queue.',
      );
      consoleSpy.mockRestore();
    });

    it('should throw errors gracefully', async () => {
      const data: StripeSessionData = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: 'order-uuid-123' },
        amount_total: 1000,
        currency: 'usd',
        payment_status: 'unpaid',
        status: 'expired',
        customer_details: {
          address: {
            city: 'Test City',
            country: 'Test Country',
            line1: 'address line 1',
            line2: 'address line 2',
            postal_code: 'POSTAL_CODE',
            state: 'Test State',
          },
          email: 'user@email.com',
        },
      };

      mockOrdersService.getOrder.mockRejectedValueOnce(
        new Error('Order not found: 123'),
      );

      await expect((processor as any).paymentExpired(data)).rejects.toThrow(
        new Error(
          'Payment expiration handling failed for Order order-uuid-123.',
        ),
      );
    });
  });

  describe('paymentSuccessful', () => {
    it('should update order status as "complete" and create new shipping instance', async () => {
      const data: StripeSessionData = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: 'order-uuid-123' },
        payment_intent: 'pi_123',
        amount_total: 1000,
        currency: 'usd',
        payment_status: 'paid',
        status: 'complete',
        customer_details: {
          address: {
            city: 'Test City',
            country: 'Test Country',
            line1: 'address line 1',
            line2: 'address line 2',
            postal_code: 'POSTAL_CODE',
            state: 'Test State',
          },
          email: 'user@email.com',
        },
      };

      const orderItems = [
        {
          id: 1,
          quantity: 1,
          book: {
            id: 1,
            title: 'Test Book 1',
            author: { name: 'Test Author One' },
          },
        },
        {
          id: 2,
          quantity: 2,
          book: {
            id: 2,
            title: 'Test Book 2',
            author: { name: 'Test Author Two' },
          },
        },
      ];

      const existingOrder = {
        order_items: orderItems,
        id: 'order-uuid-123',
        status: 'pending',
        userid: 1,
        totalPrice: 1000,
        shipping_details: null,
      };

      const updatedOrder = {
        order_items: orderItems,
        id: 'order-uuid-123',
        status: 'complete',
        userid: 1,
        totalPrice: 1000,
        shipping_details: {
          email: 'user@email.com',
        },
      };

      const shippingDetails = {
        email: data.customer_details.email,
        address: {
          country: 'Test Country',
          state: 'Test State',
          city: 'Test City',
          postalCode: 'POSTAL_CODE',
          line1: 'address line 1',
          line2: 'address line 2',
        },
      };

      const paymentData = {
        orderId: 'order-uuid-123',
        transactionId: 'pi_123',
        status: PaymentStatus.Paid,
        amount: 1000,
      };

      mockOrdersService.getOrder.mockResolvedValueOnce(existingOrder);
      mockOrdersService.updateStatus.mockResolvedValueOnce(updatedOrder);
      mockShippingService.createShipping.mockResolvedValueOnce({});
      mockPaymentService.createOrUpdatePayment.mockResolvedValueOnce({});

      const consoleSpy = jest.spyOn(console, 'warn');

      await (processor as any).paymentSuccessful(data);

      expect(mockOrdersService.getOrder).toHaveBeenCalledWith('order-uuid-123');
      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
        'order-uuid-123',
        OrderStatus.Complete,
      );

      expect(mockShippingService.createShipping).toHaveBeenCalledWith(
        'order-uuid-123',
        shippingDetails,
      );

      expect(mockPaymentService.createOrUpdatePayment).toHaveBeenCalledWith(
        paymentData,
      );

      expect(mockEmailService.sendOrderStatusChangeMail).toHaveBeenCalledWith(
        OrderStatus.Complete,
        {
          orderId: 'order-uuid-123',
          username: 'user@email.com',
          email: 'user@email.com',
        },
      );

      expect(mockStripeService.createRefundForPayment).not.toHaveBeenCalled();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Order #[order-uuid-123] marked as complete and order confirmation email added to queue.',
      );
      consoleSpy.mockRestore();
    });

    it('should throw errors gracefully', async () => {
      const data: StripeSessionData = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: 'order-uuid-123' },
        amount_total: 1000,
        currency: 'usd',
        payment_status: 'paid',
        status: 'complete',
        customer_details: {
          address: {
            city: 'Test City',
            country: 'Test Country',
            line1: 'address line 1',
            line2: 'address line 2',
            postal_code: 'POSTAL_CODE',
            state: 'Test State',
          },
          email: 'user@email.com',
        },
      };
      mockOrdersService.getOrder.mockRejectedValueOnce(
        new Error('Order not found'),
      );

      await expect((processor as any).paymentSuccessful(data)).rejects.toThrow(
        new Error('Payment success handling failed for Order order-uuid-123.'),
      );
    });
  });

  describe('process', () => {
    it('should handle payment_intent.payment_failed event', async () => {
      const job = {
        data: {
          eventType: 'payment_intent.payment_failed',
          eventData: {
            id: 'pi_123',
            object: 'payment_intent',
            amount: 1000,
            last_payment_error: {
              message: 'Your card has insufficient funds.',
            },
            metadata: { orderId: 'order-uuid-123' },
            status: 'requires_payment_method',
          },
        },
      } as any;

      const spy = jest.spyOn(processor as any, 'paymentFailed');
      await processor.process(job);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        id: 'pi_123',
        object: 'payment_intent',
        amount: 1000,
        last_payment_error: {
          message: 'Your card has insufficient funds.',
        },
        metadata: { orderId: 'order-uuid-123' },
        status: 'requires_payment_method',
      });
    });

    it('should handle checkout.session.expired event', async () => {
      const job = {
        data: {
          eventType: 'checkout.session.expired',
          eventData: {
            id: 'cs_123',
            object: 'checkout.session',
            amount_total: 1000,
            metadata: { orderId: 'order-uuid-123' },
            payment_status: 'unpaid',
            status: 'expired',
            customer_details: {
              address: {
                city: 'Test City',
                country: 'Test Country',
                line1: 'address line 1',
                line2: 'address line 2',
                postal_code: 'POSTAL_CODE',
                state: 'Test State',
              },
              email: 'user@email.com',
            },
          },
        },
      } as any;

      const orderItems = [
        {
          id: 1,
          quantity: 1,
          book: {
            id: 1,
            title: 'Test Book 1',
            author: { name: 'Test Author One' },
          },
        },
        {
          id: 2,
          quantity: 2,
          book: {
            id: 2,
            title: 'Test Book 2',
            author: { name: 'Test Author Two' },
          },
        },
      ];

      const existingOrder = {
        order_items: orderItems,
        id: 1,
        status: 'pending',
        userid: 1,
        totalPrice: 1000,
        shipping_details: null,
      };

      mockOrdersService.getOrder.mockResolvedValueOnce(existingOrder);

      const spy = jest.spyOn(processor as any, 'paymentExpired');
      await processor.process(job);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        id: 'cs_123',
        object: 'checkout.session',
        amount_total: 1000,
        metadata: { orderId: 'order-uuid-123' },
        payment_status: 'unpaid',
        status: 'expired',
        customer_details: {
          address: {
            city: 'Test City',
            country: 'Test Country',
            line1: 'address line 1',
            line2: 'address line 2',
            postal_code: 'POSTAL_CODE',
            state: 'Test State',
          },
          email: 'user@email.com',
        },
      });
    });

    it('should handle checkout.session.completed event', async () => {
      const job = {
        data: {
          eventType: 'checkout.session.completed',
          eventData: {
            id: 'cs_123',
            metadata: { orderId: 'order-uuid-123' },
            payment_intent: 'pi_123',
            amount_total: 1000,
            payment_status: 'paid',
            status: 'complete',
            customer_details: {
              address: {
                city: 'Test City',
                country: 'Test Country',
                line1: 'address line 1',
                line2: 'address line 2',
                postal_code: 'POSTAL_CODE',
                state: 'Test State',
              },
              email: 'user@email.com',
            },
          },
        },
      } as any;

      const orderItems = [
        {
          id: 1,
          quantity: 1,
          book: {
            id: 1,
            title: 'Test Book 1',
            author: { name: 'Test Author One' },
          },
        },
        {
          id: 2,
          quantity: 2,
          book: {
            id: 2,
            title: 'Test Book 2',
            author: { name: 'Test Author Two' },
          },
        },
      ];

      const existingOrder = {
        order_items: orderItems,
        id: 1,
        status: 'pending',
        userid: 1,
        totalPrice: 1000,
        shipping_details: null,
      };

      mockOrdersService.getOrder.mockResolvedValueOnce(existingOrder);

      const spy = jest.spyOn(processor as any, 'paymentSuccessful');
      await processor.process(job);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        id: 'cs_123',
        metadata: { orderId: 'order-uuid-123' },
        payment_intent: 'pi_123',
        amount_total: 1000,
        payment_status: 'paid',
        status: 'complete',
        customer_details: {
          address: {
            city: 'Test City',
            country: 'Test Country',
            line1: 'address line 1',
            line2: 'address line 2',
            postal_code: 'POSTAL_CODE',
            state: 'Test State',
          },
          email: 'user@email.com',
        },
      });
    });

    it('should log unhandled event types', async () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      const job = {
        data: {
          eventType: 'unhandled_event',
          eventData: {},
        },
      } as any;

      await (processor as any).process(job);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unhandled Stripe webhook event: unhandled_event',
      );
      consoleSpy.mockRestore();
    });
  });
});
