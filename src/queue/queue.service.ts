import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  AuthEmailTemplateKey,
  OrderEmailTemplateKey,
  RefundEmailTemplateKey,
} from 'src/common/types/email-config.type';
import { OrderMailJob, AuthMailJob } from 'src/common/types/email-job.type';
import {
  StripePaymentJob,
  StripeCheckoutJob,
  StripeRefundJob,
} from '../common/types/stripe-job.type';
import Stripe from 'stripe';

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

    @Inject('StripePaymentQueue')
    private readonly stripePaymentQueue: Queue<
      Stripe.PaymentIntent,
      any,
      string
    >,

    @Inject('StripeCheckoutQueue')
    private readonly stripeCheckoutQueue: Queue<
      Stripe.Checkout.Session,
      any,
      string
    >,

    @Inject('StripeRefundQueue')
    private readonly stripeRefundQueue: Queue<Stripe.Refund, any, string>,
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

  async addStripePaymentJob(data: StripePaymentJob) {
    try {
      await this.stripePaymentQueue.add(data.eventType, data.eventData);
    } catch (error) {
      console.log('Failed to add to the queue. Error:', error);
      throw new Error('Failed to add to the queue');
    }
  }

  async addStripeCheckoutJob(data: StripeCheckoutJob) {
    try {
      await this.stripeCheckoutQueue.add(data.eventType, data.eventData);
    } catch (error) {
      console.log('Failed to add to the queue. Error:', error);
      throw new Error('Failed to add to the queue');
    }
  }

  async addStripeRefundJob(data: StripeRefundJob) {
    try {
      await this.stripeRefundQueue.add(data.eventType, data.eventData);
    } catch (error) {
      console.log('Failed to add to the queue. Error:', error);
      throw new Error('Failed to add to the queue');
    }
  }
}
