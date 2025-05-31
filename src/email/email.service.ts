import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  OrderRefundJob,
  OrderStatusUpdateJob,
  PasswordResetJob,
} from '../queue-processor/mail-sender-queue.processor';

@Injectable()
export class EmailService {
  constructor(
    @Inject('MailSenderQueue')
    private readonly mailSenderQueue: Queue<
      OrderStatusUpdateJob | PasswordResetJob | OrderRefundJob
    >,
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
    } catch (error) {
      console.error('Failed to queue password reset email:', error);
      throw new Error(
        'Unable to send password reset email at this time. Please try again later.',
      );
    }
  }

  async sendRefundCreatedMail(data: {
    orderId: string;
    amount: string;
    email: string;
    customerName: string;
  }) {
    try {
      await this.mailSenderQueue.add('order-refund-created', data);
    } catch (error) {
      console.error(error);
      throw new Error(
        `Unable to send refund created email for Order ${data.orderId}. Please try again later.`,
      );
    }
  }

  async sendRefundCompleteddMail(data: {
    orderId: string;
    amount: string;
    email: string;
    customerName: string;
  }) {
    try {
      await this.mailSenderQueue.add('order-refund-completed', data);
    } catch (error) {
      console.error(error);
      throw new Error(
        `Unable to send refund completed email for Order ${data.orderId}. Please try again later.`,
      );
    }
  }

  async sendRefundFailedMail(data: {
    orderId: string;
    amount: string;
    email: string;
    customerName: string;
    failureReason: string;
  }) {
    try {
      await this.mailSenderQueue.add('order-refund-failed', data);
    } catch (error) {
      console.error(error);
      throw new Error(
        `Unable to send refund failed email for Order ${data.orderId}. Please try again later.`,
      );
    }
  }
}
