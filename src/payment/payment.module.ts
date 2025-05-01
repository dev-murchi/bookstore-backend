import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { QueueModule } from '../queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { StripeService } from './stripe/stripe.service';

@Module({
  imports: [QueueModule, ConfigModule, PrismaModule],
  providers: [PaymentService, StripeService],
  exports: [PaymentService, StripeService],
  controllers: [PaymentController],
})
export class PaymentModule {}
