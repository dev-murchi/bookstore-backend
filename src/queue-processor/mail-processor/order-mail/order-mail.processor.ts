import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  OrderEmailTemplateKey,
  RefundEmailTemplateKey,
} from 'src/common/types/email-config.type';
import { MailService } from 'src/mail/mail.service';
import { MailProcessorBase } from '../mail-processor.base';
import { OrderMailJob } from 'src/common/types/email-job.type';

type MailTypes = OrderEmailTemplateKey | RefundEmailTemplateKey;

@Processor('order-mail-queue')
export class OrderMailProcessor extends MailProcessorBase {
  private refundMails = new Set<RefundEmailTemplateKey>([
    'refundComplete',
    'refundCreated',
    'refundFailed',
  ]);
  constructor(protected readonly mailService: MailService) {
    super(mailService);
  }

  private isRefundMail(jobName: MailTypes) {
    return this.refundMails.has(jobName as RefundEmailTemplateKey);
  }

  async generateTemplateFields(
    job: Job<OrderMailJob, any, MailTypes>,
  ): Promise<{
    fields: Map<string, string>;
  }> {
    const { data, name: jobName, id: jobId } = job;

    this.validateFieldOrThrowError(data.email, jobId, jobName, 'email');
    this.validateFieldOrThrowError(data.orderId, jobId, jobName, 'orderId');
    this.validateFieldOrThrowError(data.username, jobId, jobName, 'username');

    const fields = new Map([
      ['{{order_id}}', data.orderId],
      ['{{customer_name}}', data.username],
    ]);

    if (jobName === 'orderShipped') {
      this.validateFieldOrThrowError(
        data.trackingId,
        jobId,
        jobName,
        'trackingId',
        "Job type 'orderShipped' requires 'trackingId'",
      );

      fields.set('{{tracking_id}}', data.trackingId);
    }

    if (this.isRefundMail(jobName)) {
      this.validateFieldOrThrowError(
        data.refundId,
        jobId,
        jobName,
        'refundId',
        `Refund mail type '${jobName}' requires 'refundId'`,
      );

      fields.set('{{refund_id}}', data.refundId);
    }

    return { fields };
  }
}
