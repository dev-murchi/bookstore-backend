import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private stripeApiKey: string;
  private stripeWebHookKey: string;

  private readonly stripe: Stripe;
  constructor(private readonly configService: ConfigService) {
    this.stripeApiKey = this.configService.get<string>('STRIPE_API_KEY');
    this.stripeWebHookKey = this.configService.get<string>('STRIPE_API_WHKEY');
    this.stripe = new Stripe(this.stripeApiKey);
  }

  async createCheckoutSession(data: Stripe.Checkout.SessionCreateParams) {
    const session = await this.stripe.checkout.sessions.create(data);
    return {
      url: session.url,
      expires: session.expires_at,
    };
  }
}
