import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { BooksModule } from './books/books.module';
import { CartModule } from './cart/cart.module';
import { PaymentModule } from './payment/payment.module';
import { QueueModule } from './queue/queue.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CategoryModule } from './category/category.module';
import { MailModule } from './mail/mail.module';
import { EmailModule } from './email/email.module';
import { QueueProcessorModule } from './queue-processor/queue-processor.module';
import { JwtGlobalModule } from './jwt-global/jwt-global.module';
import {
  jwtConfig,
  stripeConfig,
  emailConfig,
  redisConfig,
} from './common/config';
import { OrderPaymentModule } from './order-payment/order-payment.module';
import { RefundModule } from './refund/refund.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [jwtConfig, stripeConfig, emailConfig, redisConfig],
    }),
    JwtGlobalModule,
    UserModule,
    AuthModule,
    PrismaModule,
    BooksModule,
    CartModule,
    PaymentModule,
    QueueModule,
    OrdersModule,
    ReviewsModule,
    CategoryModule,
    MailModule,
    EmailModule,
    QueueProcessorModule,
    OrderPaymentModule,
    RefundModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
