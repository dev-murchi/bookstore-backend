import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import {
  MailSenderQueueJob,
  OrderStatusUpdateJob,
  PasswordResetJob,
  RefundStatusUpdateJob,
} from '../common/types/mail-sender-queue-job.type';
import { OrderStatus } from '../common/enum/order-status.enum';
import { RefundStatus } from '../common/enum/refund-status.enum';

const mockMailSenderQueue = {
  add: jest.fn(),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: 'MailSenderQueue', useValue: mockMailSenderQueue },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendOrderStatusChangeMail', () => {
    it('should add a new job to the queue', async () => {
      const data: OrderStatusUpdateJob = {
        orderId: 'order-uuid-1',
        email: 'testuser@email.com',
        username: 'testuser@email.com',
      };

      await service.sendOrderStatusChangeMail(OrderStatus.Pending, data);

      expect(mockMailSenderQueue.add).toHaveBeenCalledWith(
        'orderPending',
        data,
      );
    });

    it('should throw an error for an unknown order status', async () => {
      const data: OrderStatusUpdateJob = {
        orderId: 'order-uuid-1',
        email: 'testuser@email.com',
        username: 'testuser@email.com',
      };

      await expect(
        service.sendOrderStatusChangeMail(
          'invalid-status' as OrderStatus,
          data,
        ),
      ).rejects.toThrow(
        `Invalid template key for order ${data.orderId} status changed to invalid-status`,
      );

      expect(mockMailSenderQueue.add).not.toHaveBeenCalled();
    });

    it('should throw an error if the job could not be added to the queue', async () => {
      const data: OrderStatusUpdateJob = {
        orderId: 'order-uuid-1',
        email: 'testuser@email.com',
        username: 'testuser@email.com',
      };
      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));

      await expect(
        service.sendOrderStatusChangeMail(OrderStatus.Pending, data),
      ).rejects.toThrow(
        `Could not send email for order ${data.orderId} status changed to ${OrderStatus.Pending}`,
      );
    });
  });

  describe('sendRefundStatusChangeMail', () => {
    it('should add a new job to the queue', async () => {
      const data: RefundStatusUpdateJob = {
        orderId: 'order-uuid-2',
        email: 'refunduser@email.com',
        username: 'refunduser',
      };

      await service.sendRefundStatusChangeMail(
        RefundStatus.RefundCreated,
        data,
      );

      expect(mockMailSenderQueue.add).toHaveBeenCalledWith(
        'refundCreated',
        data,
      );
    });

    it('should throw an error if the job could not be added to the queue', async () => {
      const data: RefundStatusUpdateJob = {
        orderId: 'order-uuid-2',
        email: 'refunduser@email.com',
        username: 'refunduser',
      };
      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));

      await expect(
        service.sendRefundStatusChangeMail(RefundStatus.RefundCreated, data),
      ).rejects.toThrow(
        `Could not send email for refund status changed to ${RefundStatus.RefundCreated} for order ${data.orderId}`,
      );
    });
  });

  describe('sendResetPasswordMail', () => {
    it('should add a new job to the queue', async () => {
      const data: PasswordResetJob = {
        email: 'testuser@email.com',
        username: 'test user',
        link: 'http://localhost/reset-password?token=reset-token-123',
      };

      const spy = jest.spyOn(service as any, 'enqueueJob');

      await service.sendResetPasswordMail(data);

      expect(spy).toHaveBeenCalledWith(
        'authPasswordReset',
        data,
        `password reset for ${data.email}`,
      );

      expect(mockMailSenderQueue.add).toHaveBeenCalledWith(
        'authPasswordReset',
        data,
      );
    });

    it('should throw an error if the job could not be added to the queue', async () => {
      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));

      const data: PasswordResetJob = {
        email: 'testuser@email.com',
        username: 'test user',
        link: 'http://localhost/reset-password?token=reset-token-123',
      };

      await expect(service.sendResetPasswordMail(data)).rejects.toThrow(
        `Could not send email for password reset for ${data.email}`,
      );
    });
  });

  describe('enqueueJob', () => {
    it('should throw error on queue failure', async () => {
      const data = {} as MailSenderQueueJob;
      const key = 'key' as any;
      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));
      await expect(service['enqueueJob'](key, data, 'context')).rejects.toThrow(
        'Could not send email for context',
      );
    });

    it('should add the job to the queue successfully', async () => {
      const data = {} as MailSenderQueueJob;
      const key = 'key' as any;
      mockMailSenderQueue.add.mockResolvedValueOnce({});

      await expect(
        service['enqueueJob'](key, data, 'context'),
      ).resolves.toBeUndefined();
    });

    it('should throw error if templateKey is missing', async () => {
      const data = {} as MailSenderQueueJob;
      await expect(
        service['enqueueJob'](undefined as any, data, 'missing key'),
      ).rejects.toThrow('Invalid template key for missing key');
    });
  });
});
