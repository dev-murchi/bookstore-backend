import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import {
  AuthEmailTemplateKey,
  OrderEmailTemplateKey,
  RefundEmailTemplateKey,
} from '../common/types/email-config.type';
import { AuthMailJob, OrderMailJob } from '../common/types/email-job.type';
import {
  StripeCheckoutJob,
  StripePaymentJob,
  StripeRefundJob,
} from 'src/common/types/stripe-job.type';

const mockOrderMailQueue = {
  add: jest.fn(),
};

const mockAuthMailQueue = {
  add: jest.fn(),
};

const mockStripePaymentQueue = {
  add: jest.fn(),
};

const mockStripeCheckoutQueue = {
  add: jest.fn(),
};

const mockStripeRefundQueue = {
  add: jest.fn(),
};

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: 'OrderMailQueue', useValue: mockOrderMailQueue },
        { provide: 'AuthMailQueue', useValue: mockAuthMailQueue },
        { provide: 'StripePaymentQueue', useValue: mockStripePaymentQueue },
        { provide: 'StripeCheckoutQueue', useValue: mockStripeCheckoutQueue },
        { provide: 'StripeRefundQueue', useValue: mockStripeRefundQueue },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addAuthMailJob', () => {
    it('should add an authPasswordReset mail job to the queue on success', async () => {
      const templateKey: AuthEmailTemplateKey = 'authPasswordReset';
      const data: AuthMailJob = {
        username: 'test user',
        email: 'testuser@email.com',
        passwordResetLink:
          'http://localhost/reset-password?token=reset-token-123',
      };

      await service.addAuthMailJob(templateKey, data);

      expect(mockAuthMailQueue.add).toHaveBeenCalledTimes(1);
      expect(mockAuthMailQueue.add).toHaveBeenCalledWith(templateKey, data);
    });

    it('should throw an error if adding auth mail to queue fails', async () => {
      const errorMessage = 'Queue add failed for auth mail';
      mockAuthMailQueue.add.mockRejectedValueOnce(new Error(errorMessage));

      const templateKey: AuthEmailTemplateKey = 'authPasswordReset';
      const data: AuthMailJob = {
        username: 'test user',
        email: 'testuser@email.com',
        passwordResetLink:
          'http://localhost/reset-password?token=reset-token-123',
      };

      await expect(service.addAuthMailJob(templateKey, data)).rejects.toThrow(
        'Failed to add to the queue',
      );

      expect(mockAuthMailQueue.add).toHaveBeenCalledTimes(1);
      expect(mockAuthMailQueue.add).toHaveBeenCalledWith(templateKey, data);
    });
  });

  describe('addOrderMailJob', () => {
    it('should add an order mail job to the queue on success', async () => {
      const templateKey: OrderEmailTemplateKey = 'orderDelivered';
      const data: OrderMailJob = {
        username: 'test user',
        email: 'testuser@email.com',
        orderId: 'order-uuid-1',
      };

      await service.addOrderMailJob(templateKey, data);

      expect(mockOrderMailQueue.add).toHaveBeenCalledTimes(1);
      expect(mockOrderMailQueue.add).toHaveBeenCalledWith(templateKey, data);
    });

    it('should throw an error if adding order mail to queue fails', async () => {
      const errorMessage = 'Queue add failed for order mail';
      mockOrderMailQueue.add.mockRejectedValueOnce(new Error(errorMessage));

      const templateKey: RefundEmailTemplateKey = 'refundCreated';
      const data: OrderMailJob = {
        username: 'test user',
        email: 'testuser@email.com',
        orderId: 'order-uuid-1',
        refundId: 're_created_123',
      };

      await expect(service.addOrderMailJob(templateKey, data)).rejects.toThrow(
        'Failed to add to the queue',
      );

      expect(mockOrderMailQueue.add).toHaveBeenCalledTimes(1);
      expect(mockOrderMailQueue.add).toHaveBeenCalledWith(templateKey, data);
    });
  });

  describe('addStripePaymentJob', () => {
    it('should add a stripe payment job to the queue on success', async () => {
      const job = {
        eventType: 'payment_intent.payment_failed',
        eventData: { id: 'pi_123' },
      } as unknown as StripePaymentJob;

      await service.addStripePaymentJob(job);

      expect(mockStripePaymentQueue.add).toHaveBeenCalledTimes(1);
      expect(mockStripePaymentQueue.add).toHaveBeenCalledWith(
        job.eventType,
        job.eventData,
      );
    });

    it('should throw an error if adding stripe payment job to queue fails', async () => {
      mockStripePaymentQueue.add.mockRejectedValueOnce(new Error('failed'));

      const job = {
        eventType: 'payment_intent.payment_failed',
        eventData: { id: 'pi_456' },
      } as unknown as StripePaymentJob;
      await expect(service.addStripePaymentJob(job)).rejects.toThrow(
        'Failed to add to the queue',
      );
    });
  });

  describe('addStripeCheckoutJob', () => {
    it('should add a stripe checkout job to the queue on success', async () => {
      const job = {
        eventType: 'checkout.session.completed',
        eventData: { id: 'cs_123' },
      } as unknown as StripeCheckoutJob;

      await service.addStripeCheckoutJob(job);

      expect(mockStripeCheckoutQueue.add).toHaveBeenCalledTimes(1);
      expect(mockStripeCheckoutQueue.add).toHaveBeenCalledWith(
        job.eventType,
        job.eventData,
      );
    });

    it('should throw an error if adding stripe checkout job to queue fails', async () => {
      mockStripeCheckoutQueue.add.mockRejectedValueOnce(new Error('fail'));

      const job = {
        eventType: 'checkout.session.expired',
        eventData: { id: 'cs_456' },
      } as unknown as StripeCheckoutJob;

      await expect(service.addStripeCheckoutJob(job)).rejects.toThrow(
        'Failed to add to the queue',
      );
    });
  });

  describe('addStripeRefundJob', () => {
    it('should add a stripe refund job to the queue on success', async () => {
      const job = {
        eventType: 'refund.created',
        eventData: { id: 're_123' },
      } as unknown as StripeRefundJob;

      await service.addStripeRefundJob(job);

      expect(mockStripeRefundQueue.add).toHaveBeenCalledTimes(1);
      expect(mockStripeRefundQueue.add).toHaveBeenCalledWith(
        job.eventType,
        job.eventData,
      );
    });

    it('should throw an error if adding stripe refund job to queue fails', async () => {
      mockStripeRefundQueue.add.mockRejectedValueOnce(new Error('fail'));

      const job = {
        eventType: 'refund.failed',
        eventData: { id: 're_456' },
      } as unknown as StripeRefundJob;

      await expect(service.addStripeRefundJob(job)).rejects.toThrow(
        'Failed to add to the queue',
      );
    });
  });
});
