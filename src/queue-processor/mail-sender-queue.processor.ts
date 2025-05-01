import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailSenderService } from 'src/mail-sender/mail-sender.service';

@Processor('mail-sender-queue')
export class MailSenderQueueProcessor extends WorkerHost {
  constructor(private readonly mailSenderService: MailSenderService) {
    super();
  }
  async process(job: Job): Promise<any> {
    switch (job.name) {
      case 'order-status-mail':
        await this.sendOrderStatusMail();
        break;
      case 'password-reset':
        await this.passwordReset(job);
        break;
      default:
        console.log(job.name, job.data);
        break;
    }
    return Promise.resolve({ success: true });
  }

  private async sendOrderStatusMail() {
    console.log('Order status mail is sent.');
  }

  private async passwordReset(job: Job) {
    const { email, username, link } = job.data;
    await this.mailSenderService.sendResetPasswordMail(email, username, link);
    console.log('Password reset mail is sent.');
  }
}
