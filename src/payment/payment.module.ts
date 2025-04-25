import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { QueueModule } from 'src/queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { StripeService } from './stripe.service';

@Module({
  imports: [QueueModule, ConfigModule],
  providers: [PaymentService, StripeService],
  exports: [PaymentService],
  controllers: [PaymentController],
})
export class PaymentModule {}
