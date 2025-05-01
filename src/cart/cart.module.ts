import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from 'src/user/user.module';
import { PaymentModule } from 'src/payment/payment.module';
import { CheckoutService } from './checkout/checkout.service';

@Module({
  imports: [PrismaModule, JwtModule, UserModule, PaymentModule],
  controllers: [CartController],
  providers: [CartService, CheckoutService],
})
export class CartModule {}
