import { Module } from '@nestjs/common';
import { StripeWebhookProcessor } from './stripe-webhook-queue.processor';
import { QueueModule } from 'src/queue/queue.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StripeModule } from 'src/stripe/stripe.module';
import { MailSenderQueueProcessor } from './mail-sender-queue.processor';

@Module({
  imports: [QueueModule, PrismaModule, StripeModule],
  providers: [StripeWebhookProcessor, MailSenderQueueProcessor],
  exports: [],
})
export class QueueProcessorModule {}
