import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { QueueModule } from 'src/queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';
import { OrdersStatusService } from './orders-status.service';

@Module({
  imports: [PrismaModule, QueueModule, ConfigModule, JwtModule, UserModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersStatusService],
  exports: [OrdersService],
})
export class OrdersModule {}
