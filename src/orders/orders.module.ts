import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { QueueModule } from 'src/queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';
import { OrdersStatusService } from './orders-status.service';
import { EmailModule } from 'src/email/email.module';
import { ShippingService } from './shipping/shipping.service';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    ConfigModule,
    JwtModule,
    UserModule,
    EmailModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersStatusService, ShippingService],
  exports: [OrdersService, ShippingService],
})
export class OrdersModule {}
