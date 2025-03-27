import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { PaymentService } from 'src/payment/payment.service';

@Module({
  controllers: [CheckoutController],
  providers: [CheckoutService, PrismaService, JwtService, PaymentService],
})
export class CheckoutModule {}
