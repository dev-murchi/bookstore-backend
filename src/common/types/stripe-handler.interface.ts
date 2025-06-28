import Stripe from 'stripe';
import { OrderDTO } from '../dto/order.dto';
import { StripeEvent } from '../enum/stripe-event.enum';

export interface StripeHandler {
  eventType: StripeEvent;
  handle(
    eventData: Stripe.PaymentIntent | Stripe.Checkout.Session,
    order: OrderDTO,
  ): Promise<{ success: boolean; log: string | null }>;
}
