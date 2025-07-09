import Stripe from 'stripe';

export type StripeEventTypePaymentIntent = Extract<
  Stripe.Event.Type,
  `payment_intent${string}`
>;

export type StripeEventTypeCheckout = Extract<
  Stripe.Event.Type,
  `checkout${string}`
>;
export type StripeEventTypeRefund = Extract<
  Stripe.Event.Type,
  `refund${string}`
>;
