import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PaymentModule } from 'src/payment/payment.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [PaymentModule, JwtModule, UserModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, PrismaService, JwtService],
})
export class CheckoutModule {}
