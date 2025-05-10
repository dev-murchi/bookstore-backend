import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class EmailService {
  constructor(
    @Inject('MailSenderQueue') private readonly mailSenderQueue: Queue,
  ) {}

  async sendOrderStatusUpdate(orderId: string, status: string, email: string) {
    try {
      await this.mailSenderQueue.add('order-status-mail', {
        orderId,
        status,
        email,
      });
    } catch (error) {
      console.error(
        `Mail for Order ${orderId} could not be added to the queue. Error:`,
        error,
      );
      throw new Error(
        `Mail for Order ${orderId} could not be added to the queue.`,
      );
    }
  }

  async sendResetPasswordMail(email: string, username: string, link: string) {
    try {
      await this.mailSenderQueue.add('password-reset', {
        email,
        username,
        link,
      });
      console.log('....');
    } catch (error) {
      console.error('Failed to queue password reset email:', error);
      throw new Error(
        'Unable to send password reset email at this time. Please try again later.',
      );
    }
  }
}
