import { Module } from '@nestjs/common';
import { PaymentModule } from 'src/payment/payment.module';
import { OrdersModule } from 'src/orders/orders.module';
import { MailModule } from 'src/mail/mail.module';
import { OrderPaymentModule } from 'src/order-payment/order-payment.module';
import { StripeCheckoutExpiredHandler } from './stripe-webhook-queue/handlers/stripe-checkout-expired/stripe-checkout-expired.handler';
import { StripePaymentFailedHandler } from './stripe-webhook-queue/handlers/stripe-payment-failed/stripe-payment-failed.handler';
import { StripeCheckoutCompleteHandler } from './stripe-webhook-queue/handlers/stripe-checkout-complete/stripe-checkout-complete.handler';
import { StripeRefundCompleteHandler } from './stripe-webhook-queue/handlers/stripe-refund/stripe-refund-complete/stripe-refund-complete.handler';
import { StripeRefundCreatedHandler } from './stripe-webhook-queue/handlers/stripe-refund/stripe-refund-created/stripe-refund-created.handler';
import { StripeRefundFailedHandler } from './stripe-webhook-queue/handlers/stripe-refund/stripe-refund-failed/stripe-refund-failed.handler';
import { RefundModule } from 'src/refund/refund.module';
import { OrderMailProcessor } from './mail-processor/order-mail/order-mail.processor';
import { AuthMailProcessor } from './mail-processor/auth-mail/auth-mail.processor';
import {
  StripePaymentProcessor,
  STRIPE_PAYMENT_HANDLER,
} from './stripe-webhook-queue/stripe-payment/stripe-payment.processor';
import {
  StripeCheckoutProcessor,
  STRIPE_CHECKOUT_SESSION_HANDLER,
} from './stripe-webhook-queue/stripe-checkout/stripe-checkout.processor';
import {
  StripeRefundProcessor,
  STRIPE_REFUND_HANDLER,
} from './stripe-webhook-queue/stripe-refund/stripe-refund.processor';
import { QueueModule } from 'src/queue/queue.module';
@Module({
  imports: [
    QueueModule,
    PaymentModule,
    OrdersModule,
    MailModule,
    OrderPaymentModule,
    RefundModule,
  ],
  providers: [
    StripePaymentFailedHandler,
    StripeCheckoutExpiredHandler,
    StripeCheckoutCompleteHandler,
    StripeRefundCreatedHandler,
    StripeRefundCompleteHandler,
    StripeRefundFailedHandler,
    OrderMailProcessor,
    AuthMailProcessor,
    StripePaymentProcessor,
    StripeCheckoutProcessor,
    StripeRefundProcessor,
    {
      provide: STRIPE_PAYMENT_HANDLER,
      useFactory: (s1: StripePaymentFailedHandler) => [s1],
      inject: [StripePaymentFailedHandler],
    },
    {
      provide: STRIPE_CHECKOUT_SESSION_HANDLER,
      useFactory: (
        s1: StripeCheckoutCompleteHandler,
        s2: StripeCheckoutExpiredHandler,
      ) => [s1, s2],
      inject: [StripeCheckoutCompleteHandler, StripeCheckoutExpiredHandler],
    },
    {
      provide: STRIPE_REFUND_HANDLER,
      useFactory: (
        s1: StripeRefundCreatedHandler,
        s2: StripeRefundCompleteHandler,
        s3: StripeRefundFailedHandler,
      ) => [s1, s2, s3],
      inject: [
        StripeRefundCreatedHandler,
        StripeRefundCompleteHandler,
        StripeRefundFailedHandler,
      ],
    },
  ],
  exports: [],
})
export class QueueProcessorModule {}
