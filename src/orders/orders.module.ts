import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersStatusService } from './orders-status.service';
import { EmailModule } from 'src/email/email.module';
import { ShippingService } from './shipping/shipping.service';
import { PaymentModule } from 'src/payment/payment.module';

@Module({
  imports: [EmailModule, PaymentModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersStatusService, ShippingService],
  exports: [OrdersService, ShippingService],
})
export class OrdersModule {}
