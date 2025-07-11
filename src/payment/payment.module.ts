import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { QueueModule } from 'src/queue/queue.module';
import { PaymentController } from './payment.controller';
import { StripeService } from './stripe/stripe.service';

@Module({
  imports: [QueueModule],
  providers: [PaymentService, StripeService],
  exports: [PaymentService, StripeService],
  controllers: [PaymentController],
})
export class PaymentModule {}
