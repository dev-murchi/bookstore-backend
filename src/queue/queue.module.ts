import { Module } from '@nestjs/common';

import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
        },
      }),
      inject: [ConfigService],
    }),

    BullModule.registerQueue(
      { name: 'stripe-webhook-queue' },
      { name: 'order-mail-queue' },
      { name: 'auth-mail-queue' },
    ),
  ],
  providers: [
    {
      provide: 'StripeWebhookQueue',
      useFactory: (queue: Queue) => queue,
      inject: [getQueueToken('stripe-webhook-queue')],
    },
    {
      provide: 'OrderMailQueue',
      useFactory: (queue: Queue) => queue,
      inject: [getQueueToken('order-mail-queue')],
    },
    {
      provide: 'AuthMailQueue',
      useFactory: (queue: Queue) => queue,
      inject: [getQueueToken('auth-mail-queue')],
    },
    QueueService,
  ],
  exports: [QueueService],
})
export class QueueModule {}
