export enum StripeEvent {
  PaymentIntentFailed = 'payment_intent.payment_failed',
  CheckoutSessionExpired = 'checkout.session.expired',
  CheckoutSessionCompleted = 'checkout.session.completed',
  RefundCreated = 'refund.created',
  RefundUpdated = 'refund.updated',
  RefundFailed = 'refund.failed',
}
