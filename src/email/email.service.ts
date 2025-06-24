import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  MailSenderQueueJob,
  OrderStatusUpdateJob,
  PasswordResetJob,
  RefundStatusUpdateJob,
} from '../common/types/mail-sender-queue-job.type';
import { OrderStatus } from '../common/enum/order-status.enum';
import { RefundStatus } from '../common/enum/refund-status.enum';
import {
  AuthEmailTemplateKey,
  EmailTemplateKey,
  OrderEmailTemplateKey,
  RefundEmailTemplateKey,
} from '../common/types/email-config.type';

@Injectable()
export class EmailService {
  private readonly orderEmailTemplateKeys: Record<
    OrderStatus,
    OrderEmailTemplateKey
  > = {
    [OrderStatus.Pending]: 'orderPending',
    [OrderStatus.Complete]: 'orderComplete',
    [OrderStatus.Shipped]: 'orderShipped',
    [OrderStatus.Delivered]: 'orderDelivered',
    [OrderStatus.Canceled]: 'orderCanceled',
    [OrderStatus.Expired]: 'orderExpired',
    [OrderStatus.Returned]: 'orderReturned',
  };

  private readonly refundEmailTemplateKeys: Record<
    RefundStatus,
    RefundEmailTemplateKey
  > = {
    [RefundStatus.RefundCreated]: 'refundCreated',
    [RefundStatus.RefundComplete]: 'refundComplete',
    [RefundStatus.RefundFailed]: 'refundFailed',
  };

  private readonly authEmailTemplateKeys: Record<
    'passwordReset',
    AuthEmailTemplateKey
  > = {
    passwordReset: 'authPasswordReset',
  };

  constructor(
    @Inject('MailSenderQueue')
    private readonly mailSenderQueue: Queue<
      MailSenderQueueJob,
      any,
      EmailTemplateKey
    >,
  ) {}

  async sendResetPasswordMail(data: PasswordResetJob) {
    const templateKey = this.authEmailTemplateKeys['passwordReset'];
    const context = `password reset for ${data.email}`;
    await this.enqueueJob(templateKey, data, context);
  }

  async sendOrderStatusChangeMail(
    status: OrderStatus,
    data: OrderStatusUpdateJob,
  ) {
    const templateKey = this.orderEmailTemplateKeys[status];
    const context = `order ${data.orderId} status changed to ${status}`;
    await this.enqueueJob(templateKey, data, context);
  }

  async sendRefundStatusChangeMail(
    status: RefundStatus,
    data: RefundStatusUpdateJob,
  ) {
    const templateKey = this.refundEmailTemplateKeys[status];
    const context = `refund status changed to ${status} for order ${data.orderId}`;
    await this.enqueueJob(templateKey, data, context);
  }

  private async enqueueJob(
    templateKey: EmailTemplateKey,
    data: MailSenderQueueJob,
    context: string,
  ) {
    if (!templateKey) {
      console.error(`Missing template key for: ${context}`);
      throw new Error(`Invalid template key for ${context}`);
    }

    try {
      await this.mailSenderQueue.add(templateKey, data);
    } catch (error) {
      console.error(`Failed to enqueue email for ${context}`, error);
      throw new Error(`Could not send email for ${context}`);
    }
  }
}
