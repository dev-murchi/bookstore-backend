import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('mail-sender-queue')
export class MailSenderQueueProcessor extends WorkerHost {
  async process(job: Job): Promise<any> {
    switch (job.name) {
      case 'order-status-mail':
        await this.sendOrderStatusMail();
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
}
