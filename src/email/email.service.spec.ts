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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendOrderStatusUpdate', () => {
    it('should adds a new job to the queue. ', async () => {
      const job = {
        orderId: 1,
        status: 'complete',
        email: 'testuser@email.com',
      };

      await service.sendOrderStatusUpdate(1, 'complete', 'testuser@email.com');

      expect(mockMailSenderQueue.add).toHaveBeenCalledWith(
        'order-status-mail',
        job,
      );
    });
    it('should throw an error if the job could not be added to the queue ', async () => {
      mockMailSenderQueue.add.mockRejectedValueOnce(new Error('Queue Error'));

      await expect(
        service.sendOrderStatusUpdate(1, 'failed', 'testuser@email.com'),
      ).rejects.toThrow(
        new Error('Mail for Order 1 could not be added to the queue.'),
      );
    });
  });
});
