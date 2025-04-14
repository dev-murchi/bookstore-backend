import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { StripeWebhookProcessor } from './stripe-webhook-queue.processor';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

const mockPrismaService = {
  $transaction: jest
    .fn()
    .mockImplementation((callback) => callback(mockPrismaService)),
  payment: {
    upsert: jest.fn(),
  },
  orders: {
    update: jest.fn(),
  },
  books: {
    update: jest.fn(),
  },
  shipping: {
    create: jest.fn(),
  },
};

const mockMailService = {
  sendMail: jest.fn(),
};

describe('StripeWebhookProcessor', () => {
  let processor: StripeWebhookProcessor;
  let job: Job;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhookProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MailService, useValue: mockMailService },
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
      const data = {
        id: 'pi_123',
        object: 'payment_intent',
        amount: 1000,
        last_payment_error: {
          message: 'Your card has insufficient funds.',
        },
        metadata: { orderId: 123 },
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

      const consoleSpy = jest.spyOn(console, 'log');

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
        'Payment #1: Your card has insufficient funds.',
      );
      consoleSpy.mockRestore();
    });

    it('should throw errors gracefully', async () => {
      const data = {
        id: 'pi_123',
        metadata: { orderId: 123 },
        last_payment_error: { message: 'Payment failed' },
        amount: 1000,
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
      const data = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: 123 },
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
          bookid: 1,
        },
        {
          id: 2,
          quantity: 2,
          bookid: 2,
        },
      ];

      mockPrismaService.orders.update.mockResolvedValueOnce({
        id: 123,
        order_items: orderItems,
      });
      const consoleSpy = jest.spyOn(console, 'log');

      await (processor as any).paymentExpired(data);

      expect(mockPrismaService.orders.update).toHaveBeenCalledWith({
        where: {
          id: 123,
        },
        data: {
          status: 'expired',
        },
        select: {
          id: true,
          order_items: {
            select: {
              id: true,
              quantity: true,
              bookid: true,
            },
          },
          payment: {
            select: { id: true },
          },
        },
      });

      for (const item of orderItems) {
        expect(mockPrismaService.books.update).toHaveBeenCalledWith({
          where: { id: item.bookid },
          data: { stock_quantity: { increment: item.quantity } },
          select: { id: true, stock_quantity: true },
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

      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        'user@email.com',
        'Your Book Order #123 Has Expired',
        'Your order #123 has expired.',
        '<p>Your order #123 has expired.</p>',
      );

      expect(consoleSpy).toHaveBeenCalledWith('Order #[123] is expired.');
      consoleSpy.mockRestore();
    });

    it('should throw errors gracefully', async () => {
      const data = {
        id: 'cs_123',
        metadata: { orderId: 123 },
        amount_total: 1000,
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

      mockPrismaService.orders.update.mockRejectedValueOnce(
        new Error('DB error in paymentExpired'),
      );

      await expect((processor as any).paymentExpired(data)).rejects.toThrow(
        new Error('DB error in paymentExpired'),
      );
    });
  });

  describe('paymentSuccessful', () => {
    it('should update order status as "complete" and create new shipping instance', async () => {
      const data = {
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
      };
      const consoleSpy = jest.spyOn(console, 'log');
      await (processor as any).paymentSuccessful(data);

      // update order status
      expect(mockPrismaService.orders.update).toHaveBeenCalledWith({
        where: { id: 123 },
        data: {
          status: 'complete',
        },
      });

      // create shipping
      expect(mockPrismaService.shipping.create).toHaveBeenCalledWith({
        data: {
          email: 'user@email.com',
          order: { connect: { id: 123 } },
          address: {
            create: {
              country: 'Test Country',
              state: 'Test State',
              city: 'Test City',
              streetAddress: 'address line 1 - address line 2',
              postalCode: 'POSTAL_CODE',
            },
          },
        },
      });
      // upsert payment
      expect(mockPrismaService.payment.upsert).toHaveBeenCalledWith({
        where: { orderid: 123 },
        update: { status: 'paid' },
        create: {
          order: { connect: { id: 123 } },
          transaction_id: 'pi_123',
          status: 'paid',
          method: 'card',
          amount: 1000,
          payment_date: expect.any(Date),
        },
      });

      // send mail
      expect(mockMailService.sendMail).toHaveBeenCalledWith(
        'user@email.com',
        'Your Book Order #123 Confirmed!',
        "Your order #123 is confirmed. We'll email you tracking info soon..",
        "<p>Your order #123 is confirmed. We'll email you tracking info soon..</p>",
      );
      expect(consoleSpy).toHaveBeenCalledWith('Order #[123] is completed.');
      consoleSpy.mockRestore();
    });

    it('should throw errors gracefully', async () => {
      const data = {
        id: 'cs_123',
        metadata: { orderId: 123 },
        amount_total: 1000,
        payment_status: 'paid',
        status: 'complete',
      };

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
      // job
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
      mockPrismaService.orders.update.mockResolvedValueOnce({
        id: 123,
        order_items: [],
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
      // job
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
      mockPrismaService.orders.update.mockResolvedValueOnce({
        id: 123,
        order_items: [],
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

    it('should log unhandled event for unknown event types', async () => {
      const job = {
        data: { eventType: 'unknown.event', eventData: {} },
      } as any;
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      await processor.process(job);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Unhandled Stripe webhook event: unknown.event',
      );
      consoleLogSpy.mockRestore();
    });
  });
});
