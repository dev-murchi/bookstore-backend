import { Module } from '@nestjs/common';
import { StripeWebhookProcessor } from './stripe-webhook-queue.processor';
import { PaymentModule } from 'src/payment/payment.module';
import { OrdersModule } from 'src/orders/orders.module';
import { MailSenderQueueProcessor } from './mail-sender-queue.processor';
import { EmailModule } from 'src/email/email.module';
import { MailSenderModule } from 'src/mail-sender/mail-sender.module';

@Module({
  imports: [PaymentModule, OrdersModule, EmailModule, MailSenderModule],
  providers: [StripeWebhookProcessor, MailSenderQueueProcessor],
  exports: [],
})
export class QueueProcessorModule {}
