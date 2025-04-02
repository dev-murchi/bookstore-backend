import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { PaymentModule } from 'src/payment/payment.module';

@Module({
  imports: [PaymentModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, PrismaService, JwtService],
})
export class CheckoutModule {}
