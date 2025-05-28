import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailSenderService } from '../mail-sender/mail-sender.service';
export interface OrderStatusUpdateJob {
  orderId: string;
  status: string;
  email: string;
}

export interface PasswordResetJob {
  email: string;
  username: string;
  link: string;
}

export interface OrderRefundJob {
  orderId: string;
  amount: string;
  email: string;
  customerName: string;
  failureReason?: string;
}
@Processor('mail-sender-queue')
export class MailSenderQueueProcessor extends WorkerHost {
  constructor(private readonly mailSenderService: MailSenderService) {
    super();
  }
  async process(job: Job): Promise<any> {
    switch (job.name) {
      case 'order-status-mail':
        await this.sendOrderStatusMail(job.data);
        break;
      case 'password-reset':
        await this.passwordReset(job.data);
        break;
      case 'order-refund-created':
        await this.sendRefundCreatedMail(job.data);
        break;
      case 'order-refund-completed':
        await this.sendRefundCompletedMail(job.data);
        break;
      case 'order-refund-failed':
        this.sendRefundFailedMail(job.data);
        break;
      default:
        console.log(job.name, job.data);
        break;
    }
    return Promise.resolve({ success: true });
  }

  private async sendOrderStatusMail(data: OrderStatusUpdateJob) {
    const { orderId, status, email } = data;

    await this.mailSenderService.sendOrderStatusUpdateMail(
      email,
      orderId,
      status,
    );

    console.log('Order status mail is sent.');
  }

  private async passwordReset(data: PasswordResetJob) {
    const { email, username, link } = data;
    await this.mailSenderService.sendResetPasswordMail(email, username, link);
    console.log('Password reset mail is sent.');
  }

  private async sendRefundCreatedMail(data: OrderRefundJob) {
    const { orderId, amount, email, customerName } = data;

    await this.mailSenderService.sendRefundCreatedMail({
      orderId,
      amount,
      email,
      customerName,
    });
  }

  private async sendRefundCompletedMail(data: OrderRefundJob) {
    const { orderId, amount, email, customerName } = data;

    await this.mailSenderService.sendRefundCompletedMail({
      orderId,
      amount,
      email,
      customerName,
    });
  }

  private async sendRefundFailedMail(data: OrderRefundJob) {
    const { orderId, amount, email, customerName, failureReason } = data;

    await this.mailSenderService.sendRefundFailedMail({
      email,
      orderId,
      amount,
      customerName,
      failureReason,
    });
  }
}
