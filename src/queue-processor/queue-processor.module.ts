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
import { StripeRefundCompleteHandler } from './stripe-webhook-queue/handlers/stripe-refund/stripe-refund-complete/stripe-refund-complete.handler';
import { StripeRefundCreatedHandler } from './stripe-webhook-queue/handlers/stripe-refund/stripe-refund-created/stripe-refund-created.handler';
import { StripeRefundFailedHandler } from './stripe-webhook-queue/handlers/stripe-refund/stripe-refund-failed/stripe-refund-failed.handler';
import { RefundModule } from 'src/refund/refund.module';
@Module({
  imports: [
    PaymentModule,
    OrdersModule,
    EmailModule,
    MailSenderModule,
    OrderPaymentModule,
    RefundModule,
  ],
  providers: [
    StripeWebhookProcessor,
    MailSenderQueueProcessor,
    StripePaymentFailedHandler,
    StripeCheckoutExpiredHandler,
    StripeCheckoutCompleteHandler,
    StripeRefundCreatedHandler,
    StripeRefundCompleteHandler,
    StripeRefundFailedHandler,
    {
      provide: STRIPE_HANDLER_TOKEN,
      useFactory: (
        stripePaymentFailed: StripePaymentFailedHandler,
        stripeCheckoutExpired: StripeCheckoutExpiredHandler,
        stripeCheckoutComplete: StripeCheckoutCompleteHandler,
        stripeRefundCreatedHandler: StripeRefundCreatedHandler,
        stripeRefundCompleteHandler: StripeRefundCompleteHandler,
        stripeRefundFailedHandler: StripeRefundFailedHandler,
      ) => [
        stripePaymentFailed,
        stripeCheckoutExpired,
        stripeCheckoutComplete,
        stripeRefundCreatedHandler,
        stripeRefundCompleteHandler,
        stripeRefundFailedHandler,
      ],
      inject: [
        StripePaymentFailedHandler,
        StripeCheckoutExpiredHandler,
        StripeCheckoutCompleteHandler,
        StripeRefundCreatedHandler,
        StripeRefundCompleteHandler,
        StripeRefundFailedHandler,
      ],
    },
  ],
  exports: [],
})
export class QueueProcessorModule {}
