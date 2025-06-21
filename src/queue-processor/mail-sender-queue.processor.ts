import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailSenderService } from '../mail-sender/mail-sender.service';
import {
  MailSenderQueueJob,
  OrderStatusUpdateJob,
  PasswordResetJob,
} from '../common/types/mail-sender-queue-job.type';
import { EmailTemplateKey } from '../common/types/email-config.type';

@Processor('mail-sender-queue')
export class MailSenderQueueProcessor extends WorkerHost {
  constructor(private readonly mailSenderService: MailSenderService) {
    super();
  }
  async process(
    job: Job<MailSenderQueueJob, any, EmailTemplateKey>,
  ): Promise<any> {
    switch (job.name) {
      case 'passwordReset':
        await this.mailSenderService.sendResetPasswordMail(
          job.data as PasswordResetJob,
        );
        break;
      case 'refundCreated':
        await this.mailSenderService.sendOrderStatusChangeMail(
          'refundCreated',
          job.data as OrderStatusUpdateJob,
        );
        break;
      case 'refundComplete':
        await this.mailSenderService.sendOrderStatusChangeMail(
          'refundComplete',
          job.data as OrderStatusUpdateJob,
        );
        break;
      case 'refundFailed':
        await this.mailSenderService.sendOrderStatusChangeMail(
          'refundFailed',
          job.data as OrderStatusUpdateJob,
        );
        break;
      default:
        console.log(job.name, job.data);
        break;
    }
    return Promise.resolve({ success: true });
  }
}
