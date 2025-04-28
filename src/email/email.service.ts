import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class EmailService {
  constructor(
    @Inject('MailSenderQueue') private readonly mailSenderQueue: Queue,
  ) {}

  async sendOrderStatusUpdate(orderId: number, status: string, email: string) {
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
}
