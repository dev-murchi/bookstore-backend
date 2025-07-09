import Stripe from 'stripe';
import {
  StripeEventTypeCheckout,
  StripeEventTypePaymentIntent,
  StripeEventTypeRefund,
} from './stripe-event.type';

export type StripePaymentJob = {
  eventType: StripeEventTypePaymentIntent;
  eventData: Stripe.PaymentIntent;
};
export type StripeCheckoutJob = {
  eventType: StripeEventTypeCheckout;
  eventData: Stripe.Checkout.Session;
};
export type StripeRefundJob = {
  eventType: StripeEventTypeRefund;
  eventData: Stripe.Refund;
};
