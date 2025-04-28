import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import {
  StripePaymentData,
  StripeSessionData,
  StripeWebhookProcessor,
} from './stripe-webhook-queue.processor';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';

const mockPrismaService = {
  $transaction: jest
    .fn()
    .mockImplementation((callback) => callback(mockPrismaService)),
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

const mockMailSenderQueue = {
  add: jest.fn(),
};

const mockStripeService = {
  createRefundForPayment: jest.fn(),
};

describe('StripeWebhookProcessor', () => {
  let processor: StripeWebhookProcessor;
  let job: Job;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhookProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: 'MailSenderQueue', useValue: mockMailSenderQueue },
      ],
    }).compile();

    processor = module.get<StripeWebhookProcessor>(StripeWebhookProcessor);
    job = { data: { eventType: '', eventData: {} } } as Job;
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
        metadata: { orderId: '123' },
        status: 'requires_payment_method',
      };

      mockPrismaService.payment.upsert.mockResolvedValueOnce({
        id: 1,
        orderid: 123,
        transaction_id: 'pi_123',
        status: 'failed',
        method: 'card',
        amount: 1000,
        payment_date: null,
      });

      const consoleSpy = jest.spyOn(console, 'warn');

      await (processor as any).paymentFailed(data);

      expect(mockPrismaService.payment.upsert).toHaveBeenCalledWith({
        where: {
          orderid: 123,
        },
        create: {
          transaction_id: 'pi_123',
          order: { connect: { id: 123 } },
          status: 'failed',
          method: 'card',
          amount: 1000,
        },
        update: {
          status: 'failed',
        },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Payment #1 failed: Your card has insufficient funds.',
      );
      consoleSpy.mockRestore();
    });

    it('should throw errors gracefully', async () => {
      const data: StripePaymentData = {
        id: 'pi_123',
        metadata: { orderId: '123' },
        last_payment_error: { message: 'Payment failed' },
        amount: 1000,
        object: 'payment_intent',
        status: 'requires_payment_method',
      };

      mockPrismaService.payment.upsert.mockRejectedValueOnce(
        new Error('DB error in paymentFailed'),
      );

      await expect((processor as any).paymentFailed(data)).rejects.toThrow(
        new Error('DB error in paymentFailed'),
      );
    });
  });

  describe('paymentExpired', () => {
    it('should update order status as "expired" and update stock count of order items', async () => {
      const data: StripeSessionData = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: '123' },
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
          book: { id: 1 },
        },
        {
          id: 2,
          quantity: 2,
          book: { id: 2 },
        },
      ];

      mockPrismaService.orders.findUnique.mockResolvedValueOnce({
        id: 123,
        order_items: orderItems,
        status: 'pending',
      });

      const consoleSpy = jest.spyOn(console, 'warn');

      await (processor as any).paymentExpired(data);

      expect(mockPrismaService.orders.update).toHaveBeenCalledWith({
        where: {
          id: 123,
        },
        data: {
          status: 'expired',
        },
      });

      for (const item of orderItems) {
        expect(mockPrismaService.books.update).toHaveBeenCalledWith({
          where: { id: item.book.id },
          data: { stock_quantity: { increment: item.quantity } },
        });
      }

      expect(mockPrismaService.payment.upsert).toHaveBeenCalledWith({
        where: { orderid: 123 },
        update: { status: 'unpaid' },
        create: {
          order: { connect: { id: 123 } },
          status: 'unpaid',
          method: 'card',
          amount: 1000,
        },
      });

      expect(mockMailSenderQueue.add).toHaveBeenCalledWith(
        'order-status-mail',
        {
          orderId: 123,
          email: 'user@email.com',
          status: 'expired',
        },
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'Order #[123] expired and expiration email added to the queue.',
      );
      consoleSpy.mockRestore();
    });

    it('should throw errors gracefully', async () => {
      const data: StripeSessionData = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: '123' },
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

      mockPrismaService.orders.findUnique.mockRejectedValueOnce(
        new Error('DB error in paymentExpired'),
      );

      await expect((processor as any).paymentExpired(data)).rejects.toThrow(
        new Error('DB error in paymentExpired'),
      );
    });
  });

  describe('paymentSuccessful', () => {
    it('should update order status as "complete" and create new shipping instance', async () => {
      const data: StripeSessionData = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: '123' },
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
      mockPrismaService.orders.findUnique.mockResolvedValueOnce({
        id: 123,
        order_items: [
          {
            id: 1,
            quantity: 1,
            book: { id: 1 },
          },
          {
            id: 2,
            quantity: 2,
            book: { id: 2 },
          },
        ],
        status: 'pending',
      });

      const consoleSpy = jest.spyOn(console, 'warn');

      await (processor as any).paymentSuccessful(data);

      expect(mockPrismaService.orders.update).toHaveBeenCalledWith({
        where: { id: 123 },
        data: {
          status: 'complete',
        },
      });

      expect(mockPrismaService.shipping.create).toHaveBeenCalledWith({
        data: {
          email: 'user@email.com',
          order: { connect: { id: 123 } },
          address: {
            create: {
              country: 'Test Country',
              state: 'Test State',
              city: 'Test City',
              line1: 'address line 1',
              line2: 'address line 2',
              postalCode: 'POSTAL_CODE',
            },
          },
        },
      });

      expect(mockPrismaService.payment.upsert).toHaveBeenCalledWith({
        where: { orderid: 123 },
        update: { status: 'paid' },
        create: {
          order: { connect: { id: 123 } },
          transaction_id: 'pi_123',
          status: 'paid',
          method: 'card',
          amount: 1000,
        },
      });

      expect(mockStripeService.createRefundForPayment).not.toHaveBeenCalled(); // No refund for non-canceled orders.

      expect(mockMailSenderQueue.add).toHaveBeenCalledWith(
        'order-status-mail',
        {
          orderId: 123,
          email: 'user@email.com',
          status: 'complete',
        },
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'Order #[123] marked as complete and order confirmation email added to queue.',
      );
      consoleSpy.mockRestore();
    });

    it('should throw errors gracefully', async () => {
      const data: StripeSessionData = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: '123' },
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
      mockPrismaService.orders.findUnique.mockResolvedValueOnce({
        id: 123,
        order_items: [
          {
            id: 1,
            quantity: 1,
            book: { id: 1 },
          },
          {
            id: 2,
            quantity: 2,
            book: { id: 2 },
          },
        ],
        status: 'pending',
      });

      mockPrismaService.orders.update.mockRejectedValueOnce(
        new Error('DB error in paymentSuccessful'),
      );

      await expect((processor as any).paymentSuccessful(data)).rejects.toThrow(
        new Error('DB error in paymentSuccessful'),
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
            metadata: { orderId: 123 },
            status: 'requires_payment_method',
          },
        },
      } as any;

      mockPrismaService.payment.upsert.mockResolvedValueOnce({
        id: 1,
        orderid: 123,
        transaction_id: 'pi_123',
        status: 'failed',
        method: 'card',
        amount: 1000,
        payment_date: null,
      });

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
        metadata: { orderId: 123 },
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
            metadata: { orderId: 123 },
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
      // order
      mockPrismaService.orders.findUnique.mockResolvedValueOnce({
        id: 123,
        order_items: [
          {
            id: 1,
            quantity: 1,
            book: { id: 1 },
          },
          {
            id: 2,
            quantity: 2,
            book: { id: 2 },
          },
        ],
        status: 'pending',
      });
      // books
      mockPrismaService.books.update.mockResolvedValueOnce({});
      //payment
      mockPrismaService.payment.upsert.mockResolvedValueOnce({});

      const spy = jest.spyOn(processor as any, 'paymentExpired');
      await processor.process(job);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        id: 'cs_123',
        object: 'checkout.session',
        amount_total: 1000,
        metadata: { orderId: 123 },
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
            metadata: { orderId: 123 },
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
      // order
      mockPrismaService.orders.findUnique.mockResolvedValueOnce({
        id: 123,
        order_items: [
          {
            id: 1,
            quantity: 1,
            book: { id: 1 },
          },
          {
            id: 2,
            quantity: 2,
            book: { id: 2 },
          },
        ],
        status: 'pending',
      });
      // shipping
      mockPrismaService.shipping.create.mockResolvedValueOnce({});
      //payment
      mockPrismaService.payment.upsert.mockResolvedValueOnce({});

      const spy = jest.spyOn(processor as any, 'paymentSuccessful');
      await processor.process(job);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        id: 'cs_123',
        metadata: { orderId: 123 },
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
