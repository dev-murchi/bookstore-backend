import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { BooksModule } from './books/books.module';
import { CartModule } from './cart/cart.module';
import { PaymentModule } from './payment/payment.module';
import { QueueModule } from './queue/queue.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CategoryModule } from './category/category.module';
import { MailModule } from './mail/mail.module';
import { QueueProcessorModule } from './queue-processor/queue-processor.module';
import { JwtGlobalModule } from './jwt-global/jwt-global.module';
import {
  jwtConfig,
  stripeConfig,
  emailConfig,
  redisConfig,
  ratelimitConfig,
} from './common/config';
import { OrderPaymentModule } from './order-payment/order-payment.module';
import { RefundModule } from './refund/refund.module';
import { databaseConfig } from './common/config/database.config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [
        jwtConfig,
        stripeConfig,
        emailConfig,
        redisConfig,
        databaseConfig,
        ratelimitConfig,
      ],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'short',
          ttl: config.get('ratelimit.short.ttl'),
          limit: config.get('ratelimit.short.limit'),
        },
        {
          name: 'medium',
          ttl: config.get('ratelimit.medium.ttl'),
          limit: config.get('ratelimit.medium.limit'),
        },
        {
          name: 'long',
          ttl: config.get('ratelimit.long.ttl'),
          limit: config.get('ratelimit.long.limit'),
        },
      ],
    }),
    JwtGlobalModule,
    UserModule,
    AuthModule,
    PrismaModule.forRootAsync({
      imports: [ConfigModule], // import ConfigModule to access ConfigService
      inject: [ConfigService], // inject ConfigService into factory
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('db.url');
        if (!dbUrl) {
          throw new Error('DATABASE_URL environment variable is not set');
        }
        return { dbUrl };
      },
    }),
    BooksModule,
    CartModule,
    PaymentModule,
    QueueModule,
    OrdersModule,
    ReviewsModule,
    CategoryModule,
    MailModule,
    QueueProcessorModule,
    OrderPaymentModule,
    RefundModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
