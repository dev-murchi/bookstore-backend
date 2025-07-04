import { Module } from '@nestjs/common';
import {
  StripeWebhookProcessor,
  STRIPE_HANDLER_TOKEN,
} from './stripe-webhook-queue/stripe-webhook-queue.processor';
import { PaymentModule } from 'src/payment/payment.module';
import { OrdersModule } from 'src/orders/orders.module';
import { MailSenderQueueProcessor } from './mail-sender-queue/mail-sender-queue.processor';
import { EmailModule } from 'src/email/email.module';
import { MailSenderModule } from 'src/mail-sender/mail-sender.module';
import { OrderPaymentModule } from 'src/order-payment/order-payment.module';
import { StripeCheckoutExpired } from './stripe-webhook-queue/handlers/stripe-checkout-expired/stripe-checkout-expired.handler';
import { StripePaymentFailed } from './stripe-webhook-queue/handlers/stripe-payment-failed/stripe-payment-failed.handler';
import { StripeCheckoutComplete } from './stripe-webhook-queue/handlers/stripe-checkout-complete/stripe-checkout-complete.handler';
@Module({
  imports: [
    PaymentModule,
    OrdersModule,
    EmailModule,
    MailSenderModule,
    OrderPaymentModule,
  ],
  providers: [
    StripeWebhookProcessor,
    MailSenderQueueProcessor,
    StripePaymentFailed,
    StripeCheckoutExpired,
    StripeCheckoutComplete,
    {
      provide: STRIPE_HANDLER_TOKEN,
      useFactory: (
        stripePaymentFailed: StripePaymentFailed,
        stripeCheckoutExpired: StripeCheckoutExpired,
        stripeCheckoutComplete: StripeCheckoutComplete,
      ) => [stripePaymentFailed, stripeCheckoutExpired, stripeCheckoutComplete],
      inject: [
        StripePaymentFailed,
        StripeCheckoutExpired,
        StripeCheckoutComplete,
      ],
    },
  ],
  exports: [],
})
export class QueueProcessorModule {}
