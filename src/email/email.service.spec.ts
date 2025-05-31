import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';

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

  describe('sendOrderStatusUpdate', () => {
    it('should add a new job to the queue', async () => {
      const job = {
        orderId: 'order-uuid-1',
        status: 'complete',
        email: 'testuser@email.com',
      };

      await service.sendOrderStatusUpdate(
        'order-uuid-1',
        'complete',
        'testuser@email.com',
      );

      expect(mockMailSenderQueue.add).toHaveBeenCalledWith(
        'order-status-mail',
        job,
      );
    });
    it('should throw an error if the job could not be added to the queue ', async () => {
      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));

      await expect(
        service.sendOrderStatusUpdate(
          'order-uuid-1',
          'failed',
          'testuser@email.com',
        ),
      ).rejects.toThrow(
        new Error(
          'Mail for Order order-uuid-1 could not be added to the queue.',
        ),
      );
    });
  });

  describe('sendResetPasswordMail', () => {
    it('should adds a new job to the queue. ', async () => {
      const job = {
        email: 'testuser@email.com',
        username: 'test user',
        link: 'http://localhost/reset-password?token=reset-token-123',
      };

      await service.sendResetPasswordMail(
        'testuser@email.com',
        'test user',
        'http://localhost/reset-password?token=reset-token-123',
      );

      expect(mockMailSenderQueue.add).toHaveBeenCalledWith(
        'password-reset',
        job,
      );
    });
    it('should throw an error if the job could not be added to the queue ', async () => {
      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));

      await expect(
        service.sendResetPasswordMail(
          'testuser@email.com',
          'test user',
          'http://localhost/reset-password?token=reset-token-123',
        ),
      ).rejects.toThrow(
        new Error(
          'Unable to send password reset email at this time. Please try again later.',
        ),
      );
    });
  });

  describe('sendRefundCreatedMail', () => {
    it('should add a new job to the queue for refund creation', async () => {
      const data = {
        orderId: 'refund-order-1',
        amount: '100.00',
        email: 'customer@email.com',
        customerName: 'John Doe',
      };

      await service.sendRefundCreatedMail(data);

      expect(mockMailSenderQueue.add).toHaveBeenCalledWith(
        'order-refund-created',
        {
          orderId: 'refund-order-1',
          amount: '100.00',
          email: 'customer@email.com',
          customerName: 'John Doe',
        },
      );
    });

    it('should throw an error if the refund created job could not be added to the queue', async () => {
      const data = {
        orderId: 'refund-order-1',
        amount: '100.00',
        email: 'customer@email.com',
        customerName: 'John Doe',
      };
      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));

      await expect(service.sendRefundCreatedMail(data)).rejects.toThrow(
        `Unable to send refund created email for Order refund-order-1. Please try again later.`,
      );
      expect(mockMailSenderQueue.add).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendRefundCompleteddMail', () => {
    it('should add a new job to the queue for refund completion', async () => {
      const data = {
        orderId: 'refund-order-2',
        amount: '50.00',
        email: 'customer2@email.com',
        customerName: 'Jane Smith',
      };

      await service.sendRefundCompleteddMail(data);

      expect(mockMailSenderQueue.add).toHaveBeenCalledWith(
        'order-refund-completed',
        {
          orderId: 'refund-order-2',
          amount: '50.00',
          email: 'customer2@email.com',
          customerName: 'Jane Smith',
        },
      );
    });

    it('should throw an error if the refund completed job could not be added to the queue', async () => {
      const data = {
        orderId: 'refund-order-2',
        amount: '50.00',
        email: 'customer2@email.com',
        customerName: 'Jane Smith',
      };
      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));

      await expect(service.sendRefundCompleteddMail(data)).rejects.toThrow(
        `Unable to send refund completed email for Order refund-order-2. Please try again later.`,
      );
      expect(mockMailSenderQueue.add).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendRefundFailedMail', () => {
    it('should add a new job to the queue for refund failure', async () => {
      const data = {
        orderId: 'refund-order-3',
        amount: '75.00',
        email: 'customer3@email.com',
        customerName: 'Mike Johnson',
        failureReason: 'Payment gateway error',
      };

      await service.sendRefundFailedMail(data);

      expect(mockMailSenderQueue.add).toHaveBeenCalledWith(
        'order-refund-failed',
        {
          orderId: 'refund-order-3',
          amount: '75.00',
          email: 'customer3@email.com',
          customerName: 'Mike Johnson',
          failureReason: 'Payment gateway error',
        },
      );
    });

    it('should throw an error if the refund failed job could not be added to the queue', async () => {
      const data = {
        orderId: 'refund-order-3',
        amount: '75.00',
        email: 'customer3@email.com',
        customerName: 'Mike Johnson',
        failureReason: 'Payment gateway error',
      };
      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));

      await expect(service.sendRefundFailedMail(data)).rejects.toThrow(
        `Unable to send refund failed email for Order refund-order-3. Please try again later.`,
      );
      expect(mockMailSenderQueue.add).toHaveBeenCalledTimes(1);
    });
  });
});
