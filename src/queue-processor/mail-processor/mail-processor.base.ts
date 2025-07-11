import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EmailTemplateKey } from 'src/common/types/email-config.type';
import { BaseMailJob } from 'src/common/types/email-job.type';
import { MailService } from 'src/mail/mail.service';

export abstract class MailProcessorBase extends WorkerHost {
  constructor(protected readonly mailService: MailService) {
    super();
  }
  protected validateFieldOrThrowError(
    value: any, // The actual value of the field
    jobId: string,
    jobName: EmailTemplateKey,
    fieldName: string,
    context?: string,
  ): void {
    if (value === undefined || value === null || value === '') {
      const contextMessage = context ? ` ${context}` : '';
      const message = `Job ${jobId}: Missing '${fieldName}' in job data for job type '${jobName}'.${contextMessage}`;
      console.error(message);
      throw new Error(message);
    }
  }

  async process(
    job: Job<BaseMailJob, any, EmailTemplateKey>,
  ): Promise<{ success: boolean; message: string }> {
    const { fields } = await this.generateTemplateFields(job);

    try {
      await this.sendEmail(job.name, job.data.email, fields);
      const successMessage = `Job ${job.id}: Successfully sent email '${job.name}' to ${job.data.email}.`;
      return { success: true, message: successMessage };
    } catch (error) {
      const errorMessage = `Job ${job.id}: Failed to send email '${job.name}' to ${job.data.email}. Error: ${error.message}`;
      console.error(errorMessage, error);
      throw new Error(errorMessage);
    }
  }

  abstract generateTemplateFields(
    job: Job<BaseMailJob, any, EmailTemplateKey>,
  ): Promise<{ fields: Map<string, string> }>;

  protected async sendEmail(
    templateKey: EmailTemplateKey,
    receipient: string,
    fields: Map<string, string>,
  ): Promise<void> {
    await this.mailService.sendTemplatedEmail(templateKey, receipient, fields);
  }
}
