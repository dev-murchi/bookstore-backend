import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { BooksModule } from './books/books.module';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PaymentModule } from './payment/payment.module';
import { QueueModule } from './queue/queue.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CategoryModule } from './category/category.module';
import { StripeModule } from './stripe/stripe.module';
import { LoggerMiddleware } from './common/middleware/logger/logger.middleware';
import { MailSenderModule } from './mail-sender/mail-sender.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    UserModule,
    AuthModule,
    PrismaModule,
    BooksModule,
    CartModule,
    CheckoutModule,
    PaymentModule,
    QueueModule,
    OrdersModule,
    ReviewsModule,
    CategoryModule,
    StripeModule,
    MailSenderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
