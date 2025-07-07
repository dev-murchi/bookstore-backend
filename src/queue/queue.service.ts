import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  AuthEmailTemplateKey,
  OrderEmailTemplateKey,
  RefundEmailTemplateKey,
} from 'src/common/types/email-config.type';
import { OrderMailJob, AuthMailJob } from 'src/common/types/email-job.type';

type MailTemplateKeys = OrderEmailTemplateKey | RefundEmailTemplateKey;

@Injectable()
export class QueueService {
  constructor(
    @Inject('OrderMailQueue')
    private readonly orderMailQueue: Queue<OrderMailJob, any, MailTemplateKeys>,
    @Inject('AuthMailQueue')
    private readonly authMailQueue: Queue<
      AuthMailJob,
      any,
      AuthEmailTemplateKey
    >,
  ) {}

  async addAuthMailJob(templateKey: AuthEmailTemplateKey, data: AuthMailJob) {
    try {
      await this.authMailQueue.add(templateKey, data);
    } catch (error) {
      console.log('Failed to add to the queue. Error:', error);
      throw new Error('Failed to add to the queue');
    }
  }

  async addOrderMailJob(templateKey: MailTemplateKeys, data: OrderMailJob) {
    try {
      await this.orderMailQueue.add(templateKey, data);
    } catch (error) {
      console.log('Failed to add to the queue. Error:', error);
      throw new Error('Failed to add to the queue');
    }
  }
}
