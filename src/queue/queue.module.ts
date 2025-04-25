import { Module } from '@nestjs/common';

import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { StripeWebhookProcessor } from './stripe-webhook-queue.processor';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailModule } from 'src/mail/mail.module';
import { MailSenderQueueProcessor } from './mail-sender-queue.processor';
@Module({
  imports: [
    MailModule,
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
    StripeWebhookProcessor,
    MailSenderQueueProcessor,
    PrismaService,
  ],
  exports: ['StripeWebhookQueue', 'MailSenderQueue'],
})
export class QueueModule {}
