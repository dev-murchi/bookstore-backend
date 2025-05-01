import { Module } from '@nestjs/common';
import { StripeWebhookProcessor } from './stripe-webhook-queue.processor';
import { QueueModule } from 'src/queue/queue.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StripeModule } from 'src/stripe/stripe.module';
import { PaymentModule } from 'src/payment/payment.module';
import { OrdersModule } from 'src/orders/orders.module';
import { MailSenderQueueProcessor } from './mail-sender-queue.processor';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    QueueModule,
    PrismaModule,
    StripeModule,
    PaymentModule,
    OrdersModule,
    EmailModule,
  ],
  providers: [StripeWebhookProcessor, MailSenderQueueProcessor],
  exports: [],
})
export class QueueProcessorModule {}
