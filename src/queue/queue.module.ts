import { Module } from '@nestjs/common';

import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
@Module({
  imports: [
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
  ],
  exports: ['StripeWebhookQueue', 'MailSenderQueue'],
})
export class QueueModule {}
