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
import { StripeCheckoutExpiredHandler } from './stripe-webhook-queue/handlers/stripe-checkout-expired/stripe-checkout-expired.handler';
import { StripePaymentFailedHandler } from './stripe-webhook-queue/handlers/stripe-payment-failed/stripe-payment-failed.handler';
import { StripeCheckoutCompleteHandler } from './stripe-webhook-queue/handlers/stripe-checkout-complete/stripe-checkout-complete.handler';
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
    StripePaymentFailedHandler,
    StripeCheckoutExpiredHandler,
    StripeCheckoutCompleteHandler,
    {
      provide: STRIPE_HANDLER_TOKEN,
      useFactory: (
        stripePaymentFailed: StripePaymentFailedHandler,
        stripeCheckoutExpired: StripeCheckoutExpiredHandler,
        stripeCheckoutComplete: StripeCheckoutCompleteHandler,
      ) => [stripePaymentFailed, stripeCheckoutExpired, stripeCheckoutComplete],
      inject: [
        StripePaymentFailedHandler,
        StripeCheckoutExpiredHandler,
        StripeCheckoutCompleteHandler,
      ],
    },
  ],
  exports: [],
})
export class QueueProcessorModule {}
