import { Module } from '@nestjs/common';

import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { StripeWebhookProcessor } from './stripe-webhook-queue.processor';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
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

    BullModule.registerQueue({
      name: 'stripe-webhook-queue',
    }),
  ],
  providers: [
    {
      provide: 'StripeWebhookQueue',
      useFactory: (queue: Queue) => queue,
      inject: [getQueueToken('stripe-webhook-queue')],
    },
    StripeWebhookProcessor,
    PrismaService,
  ],
  exports: ['StripeWebhookQueue'],
})
export class QueueModule {}
