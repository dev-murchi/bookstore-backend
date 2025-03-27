import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

const mockStripeCheckoutSessionsCreateFunc = jest.fn();

jest.mock('stripe', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockStripeCheckoutSessionsCreateFunc,
        },
      },
    })),
  };
});

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'STRIPE_API_KEY') return 'test-api-key';
    if (key === 'STRIPE_API_WHKEY') return 'test-webhook-key';
  }),
};

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session and return the url and expires time', async () => {
      const checkoutSessionData: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Test Book 1',
              },
              unit_amount: 1000,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: 'https://localhost/success',
        cancel_url: 'https://localhost/cancel',
      };

      const mockSession = {
        url: 'https://checkout.stripe.com/test-session-url',
        expires_at: 1672531199,
      };

      mockStripeCheckoutSessionsCreateFunc.mockResolvedValueOnce(mockSession);

      const result = await service.createCheckoutSession(checkoutSessionData);

      expect(mockStripeCheckoutSessionsCreateFunc).toHaveBeenCalledWith(
        checkoutSessionData,
      );

      expect(result).toEqual({
        url: 'https://checkout.stripe.com/test-session-url',
        expires: 1672531199,
      });
    });
  });
});
