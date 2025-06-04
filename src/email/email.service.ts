import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  MailSenderQueueJob,
  OrderStatusUpdateJob,
  PasswordResetJob,
} from '../common/types/mail-sender-queue-job.type';
import { OrderStatus } from '../common/enum/order-status.enum';
import { EmailTemplateKey } from '../common/config';

@Injectable()
export class EmailService {
  private static readonly mailStatusToTemplate = new Map<
    OrderStatus,
    EmailTemplateKey
  >([
    [OrderStatus.RefundCreated, 'refundCreated'],
    [OrderStatus.RefundComplete, 'refundComplete'],
    [OrderStatus.RefundFailed, 'refundFailed'],
    [OrderStatus.Pending, 'orderPending'],
    [OrderStatus.Complete, 'orderComplete'],
    [OrderStatus.Shipped, 'orderShipped'],
    [OrderStatus.Delivered, 'orderDelivered'],
    [OrderStatus.Canceled, 'orderCanceled'],
    [OrderStatus.Expired, 'orderExipred'],
  ]);

  constructor(
    @Inject('MailSenderQueue')
    private readonly mailSenderQueue: Queue<
      MailSenderQueueJob,
      any,
      EmailTemplateKey
    >,
  ) {}

  async sendResetPasswordMail(data: PasswordResetJob) {
    await this.enqueueJob(
      'passwordReset',
      data,
      `password reset to ${data.email}`,
    );
  }

  async sendOrderStatusChangeMail(
    status: OrderStatus,
    data: OrderStatusUpdateJob,
  ) {
    const key = EmailService.mailStatusToTemplate.get(status);
    if (!key) {
      throw new Error(`Unknown order status: ${status}.`);
    }
    await this.enqueueJob(
      key,
      data,
      `order ${data.orderId} with status ${status}`,
    );
  }

  async enqueueJob(
    jobName: EmailTemplateKey,
    data: MailSenderQueueJob,
    context: string,
  ) {
    try {
      await this.mailSenderQueue.add(jobName, data);
    } catch (error) {
      console.error(`Failed to enqueue job for ${context}`, error);
      throw new Error(`Could not send email for ${context}`);
    }
  }
}
