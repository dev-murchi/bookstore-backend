import { Test, TestingModule } from '@nestjs/testing';
import { MailSenderQueueProcessor } from './mail-sender-queue.processor';
import { MailSenderService } from '../../mail-sender/mail-sender.service';
import { Job } from 'bullmq';
import {
  MailSenderQueueJob,
  PasswordResetJob,
} from '../../common/types/mail-sender-queue-job.type';
import { EmailTemplateKey } from '../../common/types/email-config.type';

describe('MailSenderQueueProcessor', () => {
  let processor: MailSenderQueueProcessor;
  let mailSenderService: MailSenderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailSenderQueueProcessor,
        {
          provide: MailSenderService,
          useValue: {
            sendResetPasswordMail: jest.fn(),
            sendOrderStatusChangeMail: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<MailSenderQueueProcessor>(MailSenderQueueProcessor);
    mailSenderService = module.get<MailSenderService>(MailSenderService);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should process authPasswordReset job correctly', async () => {
    const job = {
      name: 'authPasswordReset',
      data: {
        email: 'user@example.com',
        username: 'username',
        link: 'http//localhost/password-reset',
      },
    };

    await processor.process(
      job as Job<PasswordResetJob, any, EmailTemplateKey>,
    );

    expect(mailSenderService.sendResetPasswordMail).toHaveBeenCalledWith(
      job.data,
    );
  });

  it('should process refundCreated job correctly', async () => {
    const job = {
      name: 'refundCreated',
      data: {
        orderId: '123',
        email: 'user@email.com',
        username: 'username',
      },
    } as Job<MailSenderQueueJob, any, EmailTemplateKey>;

    await processor.process(job);

    expect(mailSenderService.sendOrderStatusChangeMail).toHaveBeenCalledWith(
      'refundCreated',
      job.data,
    );
  });

  it('should process refundComplete job correctly', async () => {
    const job = {
      name: 'refundComplete',
      data: {
        orderId: '124',
        email: 'user@email.com',
        username: 'username',
      },
    } as Job<MailSenderQueueJob, any, EmailTemplateKey>;

    await processor.process(job);

    expect(mailSenderService.sendOrderStatusChangeMail).toHaveBeenCalledWith(
      'refundComplete',
      job.data,
    );
  });

  it('should process refundFailed job correctly', async () => {
    const job = {
      name: 'refundFailed',
      data: {
        orderId: '125',
        email: 'user@email.com',
        username: 'username',
      },
    } as Job<MailSenderQueueJob, any, EmailTemplateKey>;

    await processor.process(job);

    expect(mailSenderService.sendOrderStatusChangeMail).toHaveBeenCalledWith(
      'refundFailed',
      job.data,
    );
  });

  it('should return success when processing completes', async () => {
    const job = {
      name: 'refundCreated',
      data: {
        orderId: '123',
        email: 'user@email.com',
        username: 'username',
      },
    } as Job<MailSenderQueueJob, any, EmailTemplateKey>;

    const result = await processor.process(job);

    expect(result).toEqual({ success: true });
  });

  it('should handle unknown job names correctly', async () => {
    const job = {
      name: 'unknownJob' as unknown as EmailTemplateKey,
      data: { someData: 'value' } as unknown as MailSenderQueueJob,
    } as Job<MailSenderQueueJob, any, EmailTemplateKey>;

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await processor.process(job);

    expect(consoleSpy).toHaveBeenCalledWith(job.name, job.data);
  });
});
