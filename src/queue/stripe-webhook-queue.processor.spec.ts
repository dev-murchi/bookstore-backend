import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { StripeWebhookProcessor } from './stripe-webhook-queue.processor';
import { PrismaService } from '../prisma/prisma.service';
const eventTypes = {
  paymentFailed: 'payment_intent.payment_failed',
  paymentSuccessful: 'checkout.session.completed',
  paymentCancelled: 'checkout.session.expired',
};

const mockPrismaService = {
  payment: {
    upsert: jest.fn(),
  },
};

describe('StripeWebhookProcessor', () => {
  let processor: StripeWebhookProcessor;
  let job: Job;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhookProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    processor = module.get<StripeWebhookProcessor>(StripeWebhookProcessor);
    job = { data: { eventType: '', eventData: {} } } as Job;
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('paymentFailed', () => {
    it('should upsert payment with correct data', async () => {
      const data = {
        id: 'pi_123',
        metadata: { orderId: 'order_123' },
        last_payment_error: { message: 'Your card has insufficient funds.' },
        amount: 1000,
      };

      mockPrismaService.payment.upsert.mockResolvedValueOnce({
        id: 1,
        orderid: 'order_123',
        transaction_id: 'pi_123',
        status: 'requires payment method',
        method: 'card',
        amount: 1000,
        payment_date: null,
      });

      const consoleSpy = jest.spyOn(console, 'log');

      await (processor as any).paymentFailed(data);

      expect(mockPrismaService.payment.upsert).toHaveBeenCalledWith({
        where: {
          transaction_id: 'pi_123',
          AND: [{ orderid: 'order_123' }],
        },
        create: {
          transaction_id: 'pi_123',
          order: { connect: { id: 'order_123' } },
          status: 'requires payment method',
          method: 'card',
          amount: 1000,
        },
        update: {
          status: 'requires payment method',
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
        metadata: { orderId: 'order_123' },
        last_payment_error: { message: 'Payment failed' },
        amount: 1000,
      };

      mockPrismaService.payment.upsert.mockRejectedValueOnce(
        new Error('Prisma error'),
      );

      await expect((processor as any).paymentFailed(data)).rejects.toThrow(
        new Error('Prisma error'),
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
            metadata: { orderId: 'order_123' },
            status: 'requires payment method',
          },
        },
      } as any;

      mockPrismaService.payment.upsert.mockResolvedValueOnce({
        id: 1,
        orderid: 'order_123',
        transaction_id: 'pi_123',
        status: 'requires payment method',
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
        metadata: { orderId: 'order_123' },
        status: 'requires payment method',
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
