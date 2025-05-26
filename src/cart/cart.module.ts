import { Module } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { PaymentModule } from 'src/payment/payment.module';
import { CheckoutService } from './checkout/checkout.service';

@Module({
  imports: [PaymentModule],
  controllers: [CartController],
  providers: [CartService, CheckoutService],
})
export class CartModule {}
