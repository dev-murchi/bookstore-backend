import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  EmailTemplateField,
  OrderEmailTemplateKey,
  RefundEmailTemplateKey,
} from '../../../common/types/email-config.type';
import { MailService } from '../../../mail/mail.service';
import { MailProcessorBase } from '../mail-processor.base';
import { OrderMailJob } from '../../../common/types/email-job.type';

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
    fields: EmailTemplateField[];
  }> {
    const { data, name: jobName, id: jobId } = job;

    this.validateFieldOrThrowError(data.email, jobId, jobName, 'email');
    this.validateFieldOrThrowError(data.orderId, jobId, jobName, 'orderId');
    this.validateFieldOrThrowError(data.username, jobId, jobName, 'username');

    const fields: EmailTemplateField[] = [
      { key: '{{order_id}}', value: data.orderId },
      { key: '{{customer_name}}', value: data.username },
    ];

    if (jobName === 'orderShipped') {
      this.validateFieldOrThrowError(
        data.trackingId,
        jobId,
        jobName,
        'trackingId',
        "Job type 'orderShipped' requires 'trackingId'",
      );

      fields.push({ key: '{{tracking_id}}', value: data.trackingId });
    }

    if (this.isRefundMail(jobName)) {
      this.validateFieldOrThrowError(
        data.refundId,
        jobId,
        jobName,
        'refundId',
        `Refund mail type '${jobName}' requires 'refundId'`,
      );

      fields.push({ key: '{{refund_id}}', value: data.refundId });
    }

    return { fields };
  }
}
