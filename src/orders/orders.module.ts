import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersStatusService } from './orders-status.service';
import { ShippingService } from './shipping/shipping.service';
import { PaymentModule } from 'src/payment/payment.module';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [PaymentModule, QueueModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersStatusService, ShippingService],
  exports: [OrdersService, ShippingService],
})
export class OrdersModule {}
