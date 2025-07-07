import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import {
  AuthEmailTemplateKey,
  OrderEmailTemplateKey,
  RefundEmailTemplateKey,
} from '../common/types/email-config.type';
import { AuthMailJob, OrderMailJob } from '../common/types/email-job.type';

const mockOrderMailQueue = {
  add: jest.fn(),
};

const mockAuthMailQueue = {
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
});
