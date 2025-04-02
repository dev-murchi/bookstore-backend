import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { QueueModule } from 'src/queue/queue.module';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';

@Module({
  imports: [QueueModule, ConfigModule],
  providers: [PaymentService],
  exports: [PaymentService],
  controllers: [PaymentController],
})
export class PaymentModule {}
