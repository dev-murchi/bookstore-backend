import { Job } from 'bullmq';
import { EmailTemplateKey } from 'src/common/types/email-config.type';
import { BaseMailJob } from 'src/common/types/email-job.type';
import { MailProcessorBase } from './mail-processor.base';
import { MailService } from 'src/mail/mail.service';

const mockMailService = {
  sendTemplatedEmail: jest.fn(),
} as unknown as MailService;

const mockJob: Job<BaseMailJob, any, EmailTemplateKey> = {
  id: '123',
  name: 'orderComplete',
  data: {
    email: 'testuser@email.com',
    username: 'Test User',
  },
} as any;

class TestMailProcessor extends MailProcessorBase {
  async generateTemplateFields(
    job: Job<BaseMailJob, any, EmailTemplateKey>,
  ): Promise<{ fields: Map<string, string> }> {
    return { fields: new Map([['{{username}}', job.data.username]]) };
  }
}

describe('MailProcessorBase', () => {
  let processor: TestMailProcessor;

  beforeEach(() => {
    (mockMailService.sendTemplatedEmail as jest.Mock).mockReset();

    processor = new TestMailProcessor(mockMailService);
  });

  describe('validateFieldOrThrowError', () => {
    it('should not throw for valid field', () => {
      expect(() =>
        processor['validateFieldOrThrowError'](
          'value',
          '123',
          'orderComplete',
          'username',
        ),
      ).not.toThrow();
    });

    it.each([undefined, null, ''])(
      'should throw for missing field (%s)',
      (badValue) => {
        expect(() =>
          processor['validateFieldOrThrowError'](
            badValue,
            '123',
            'orderComplete',
            'username',
            'in context',
          ),
        ).toThrow(
          "Job 123: Missing 'username' in job data for job type 'orderComplete'. in context",
        );
      },
    );

    it('should throw without context message when context is undefined', () => {
      expect(() =>
        processor['validateFieldOrThrowError'](
          '',
          '123',
          'orderComplete',
          'username',
        ),
      ).toThrow(
        "Job 123: Missing 'username' in job data for job type 'orderComplete'.",
      );
    });
  });

  describe('sendEmail', () => {
    it('should call mailService.sendTemplatedEmail with correct args', async () => {
      const fields = new Map([['username', 'Test User']]);
      await processor['sendEmail'](
        'orderComplete',
        'testuser@email.com',
        fields,
      );
      expect(mockMailService.sendTemplatedEmail).toHaveBeenCalledWith(
        'orderComplete',
        'testuser@email.com',
        fields,
      );
    });
  });

  describe('process', () => {
    it('should send email successfully and return success message', async () => {
      (mockMailService.sendTemplatedEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await processor.process(mockJob);
      expect(result.success).toBe(true);
      expect(result.message).toMatch(/Successfully sent email/);
    });

    it('should throw error when sendEmail fails', async () => {
      (mockMailService.sendTemplatedEmail as jest.Mock).mockRejectedValue(
        new Error('SMTP error'),
      );

      await expect(processor.process(mockJob)).rejects.toThrow(
        "Job 123: Failed to send email 'orderComplete' to testuser@email.com. Error: SMTP error",
      );
    });
  });
});
