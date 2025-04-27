import { Module } from '@nestjs/common';

import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { StripeWebhookProcessor } from './stripe-webhook-queue.processor';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailSenderModule } from '../mail-sender/mail-sender.module';
import { MailSenderQueueProcessor } from './mail-sender-queue.processor';
import { StripeModule } from '../stripe/stripe.module';
@Module({
  imports: [
    MailSenderModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('QUEUE_HOST'),
          port: configService.get('QUEUE_PORT'),
        },
      }),
      inject: [ConfigService],
    }),

    BullModule.registerQueue(
      { name: 'stripe-webhook-queue' },
      { name: 'mail-sender-queue' },
    ),
    StripeModule,
  ],
  providers: [
    {
      provide: 'StripeWebhookQueue',
      useFactory: (queue: Queue) => queue,
      inject: [getQueueToken('stripe-webhook-queue')],
    },
    {
      provide: 'MailSenderQueue',
      useFactory: (queue: Queue) => queue,
      inject: [getQueueToken('mail-sender-queue')],
    },
    StripeWebhookProcessor,
    MailSenderQueueProcessor,
    PrismaService,
  ],
  exports: ['StripeWebhookQueue', 'MailSenderQueue'],
})
export class QueueModule {}
