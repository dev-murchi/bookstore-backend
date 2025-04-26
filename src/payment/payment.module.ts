import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { QueueModule } from '../queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [QueueModule, ConfigModule, StripeModule],
  providers: [PaymentService],
  exports: [PaymentService],
  controllers: [PaymentController],
})
export class PaymentModule {}
