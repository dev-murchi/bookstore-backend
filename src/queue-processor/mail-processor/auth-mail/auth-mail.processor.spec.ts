import { Test, TestingModule } from '@nestjs/testing';
import { AuthMailProcessor } from './auth-mail.processor';
import { MailService } from 'src/mail/mail.service';
import { Job } from 'bullmq';
import { AuthEmailTemplateKey } from 'src/common/types/email-config.type';
import { AuthMailJob } from 'src/common/types/email-job.type';

const baseJobData = {
  email: 'user@example.com',
  username: 'John Doe',
};

const baseJob = {
  id: 'job-1',
  name: 'authPasswordReset' as AuthEmailTemplateKey,
  data: {
    ...baseJobData,
    passwordResetLink: 'http://localhost/reset-password?token=mockToken',
  },
} as Job<AuthMailJob, any, AuthEmailTemplateKey>;

const mockSendTemplatedEmail = jest.fn();

const mockMailService = {
  sendTemplatedEmail: mockSendTemplatedEmail,
};

describe('AuthMailProcessor', () => {
  let processor: AuthMailProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthMailProcessor,
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    processor = module.get<AuthMailProcessor>(AuthMailProcessor);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('generateTemplateFields', () => {
    it('should generate fields for authPasswordReset', async () => {
      const result = await processor.generateTemplateFields(baseJob);
      expect(result.fields).toEqual(
        new Map([
          ['{{customer_name}}', 'John Doe'],
          ['{{link}}', 'http://localhost/reset-password?token=mockToken'],
        ]),
      );
    });

    it('should generate fields without password reset link for other auth jobs', async () => {
      const job = {
        ...baseJob,
        name: 'authSomethingElse' as AuthEmailTemplateKey,
        data: { ...baseJobData },
      } as Job<AuthMailJob, any, AuthEmailTemplateKey>;
      const result = await processor.generateTemplateFields(job);
      expect(result.fields).toEqual(
        new Map([['{{customer_name}}', 'John Doe']]),
      );
    });

    it('should throw if email is missing', async () => {
      const job = {
        ...baseJob,
        data: { ...baseJob.data, email: '' },
      } as Job<AuthMailJob, any, AuthEmailTemplateKey>;

      await expect(processor.generateTemplateFields(job)).rejects.toThrow(
        "Job job-1: Missing 'email' in job data for job type 'authPasswordReset'.",
      );
    });

    it('should throw if username is missing', async () => {
      const job = {
        ...baseJob,
        data: { ...baseJob.data, username: null },
      } as Job<AuthMailJob, any, AuthEmailTemplateKey>;

      await expect(processor.generateTemplateFields(job)).rejects.toThrow(
        "Job job-1: Missing 'username' in job data for job type 'authPasswordReset'.",
      );
    });

    it('should throw if passwordResetLink is missing for authPasswordReset', async () => {
      const job = {
        ...baseJob,
        data: { ...baseJob.data, passwordResetLink: undefined },
      } as Job<AuthMailJob, any, AuthEmailTemplateKey>;

      await expect(processor.generateTemplateFields(job)).rejects.toThrow(
        "Job job-1: Missing 'passwordResetLink' in job data for job type 'authPasswordReset'.",
      );
    });
  });

  describe('process', () => {
    it('should call mailService.sendTemplatedEmail with correct fields', async () => {
      mockSendTemplatedEmail.mockResolvedValue(undefined);

      const result = await processor.process(baseJob);
      expect(result.success).toBe(true);
      expect(mockSendTemplatedEmail).toHaveBeenCalledWith(
        'authPasswordReset',
        'user@example.com',
        new Map([
          ['{{customer_name}}', 'John Doe'],
          ['{{link}}', 'http://localhost/reset-password?token=mockToken'],
        ]),
      );
    });

    it('should throw if sending the email fails', async () => {
      mockSendTemplatedEmail.mockRejectedValue(new Error('SMTP down'));

      await expect(processor.process(baseJob)).rejects.toThrow(
        "Job job-1: Failed to send email 'authPasswordReset' to user@example.com. Error: SMTP down",
      );
    });
  });
});
