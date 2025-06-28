import { Module } from '@nestjs/common';
import { OrderPaymentService } from './order-payment.service';

@Module({
  providers: [OrderPaymentService],
  exports: [OrderPaymentService],
})
export class OrderPaymentModule {}
