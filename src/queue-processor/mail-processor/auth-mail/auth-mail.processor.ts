import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AuthEmailTemplateKey } from '../../../common/types/email-config.type';
import { AuthMailJob } from '../../../common/types/email-job.type';
import { MailService } from '../../../mail/mail.service';
import { MailProcessorBase } from '../mail-processor.base';

@Processor('auth-mail-queue')
export class AuthMailProcessor extends MailProcessorBase {
  constructor(protected readonly mailService: MailService) {
    super(mailService);
  }

  async generateTemplateFields(
    job: Job<AuthMailJob, any, AuthEmailTemplateKey>,
  ): Promise<{ fields: Map<string, string> }> {
    const { data, name: jobName, id: jobId } = job;

    this.validateFieldOrThrowError(data.email, jobId, jobName, 'email');
    this.validateFieldOrThrowError(data.username, jobId, jobName, 'username');

    const fields = new Map([['{{customer_name}}', data.username]]);

    if (jobName === 'authPasswordReset') {
      this.validateFieldOrThrowError(
        job.data.passwordResetLink,
        jobId,
        jobName,
        'passwordResetLink',
        '',
      );

      fields.set('{{link}}', data.passwordResetLink);
    }

    return { fields };
  }
}
