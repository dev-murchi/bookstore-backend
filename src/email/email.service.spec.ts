import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import {
  MailSenderQueueJob,
  OrderStatusUpdateJob,
  PasswordResetJob,
} from '../common/types/mail-sender-queue-job.type';
import { OrderStatus } from '../common/enum/order-status.enum';
import { RefundStatus } from '../common/enum/refund-status.enum';
import { EmailTemplateKey } from 'src/common/types/email-config.type';

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

  //  sendOrderStatusChange
  describe('sendOrderStatusChangeMail', () => {
    it('should add a new job to the queue', async () => {
      const data: OrderStatusUpdateJob = {
        orderId: 'order-uuid-1',
        email: 'testuser@email.com',
        username: 'testuser@email.com',
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
      ).rejects.toThrow(`Unknown order status: invalid-status.`);

      expect(mockMailSenderQueue.add).not.toHaveBeenCalled();
    });
    it('should throw an error if the job could not be added to the queue ', async () => {
      const data: OrderStatusUpdateJob = {
        orderId: 'order-uuid-1',
        email: 'testuser@email.com',
        username: 'testuser@email.com',
      };

      const status = RefundStatus.RefundCreated;

      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));

      await expect(
        service.sendRefundStatusChangeMail(status, data),
      ).rejects.toThrow(
        `Could not send email for order ${data.orderId} with status ${status}`,
      );
    });
  });

  describe('sendResetPasswordMail', () => {
    it('should adds a new job to the queue. ', async () => {
      const data: PasswordResetJob = {
        email: 'testuser@email.com',
        username: 'test user',
        link: 'http://localhost/reset-password?token=reset-token-123',
      };

      const spy = jest.spyOn(service, 'enqueueJob');

      await service.sendResetPasswordMail(data);

      expect(spy).toHaveBeenCalledWith(
        'passwordReset',
        data,
        `password reset to ${data.email}`,
      );

      expect(mockMailSenderQueue.add).toHaveBeenCalledWith(
        'passwordReset',
        data,
      );
    });

    it('should throw an error if the job could not be added to the queue ', async () => {
      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));

      const data: PasswordResetJob = {
        email: 'testuser@email.com',
        username: 'test user',
        link: 'http://localhost/reset-password?token=reset-token-123',
      };

      await expect(service.sendResetPasswordMail(data)).rejects.toThrow(
        `Could not send email for password reset to ${data.email}`,
      );
    });
  });

  describe('enqueueJob', () => {
    it('should throw error ', async () => {
      const data = {} as MailSenderQueueJob;
      const key = 'key' as EmailTemplateKey;
      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));
      await expect(service.enqueueJob(key, data, 'context')).rejects.toThrow(
        'Could not send email for context',
      );
    });

    it('should add the job to the queue', async () => {
      const data = {} as MailSenderQueueJob;
      const key = 'key' as EmailTemplateKey;
      mockMailSenderQueue.add.mockResolvedValueOnce({});

      await expect(
        service.enqueueJob(key, data, 'context'),
      ).resolves.toBeUndefined();
    });
  });
});
