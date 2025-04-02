import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

const mockStripeCheckoutSessionsCreateFunc = jest.fn();
const mockStripWebhooksConstructEventAsync = jest.fn();
const mockQueueAdd = jest.fn();

jest.mock('stripe', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockStripeCheckoutSessionsCreateFunc,
        },
      },
      webhooks: {
        constructEventAsync: mockStripWebhooksConstructEventAsync,
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
        { provide: 'StripeWebhookQueue', useValue: { add: mockQueueAdd } },
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

  describe('handleStripeWebhook', () => {
    it('should throw an error if the Stripe webhook secret is not configured', async () => {
      service['stripeWebhookKey'] = ''; // Simulate missing key
      const payload = Buffer.from('test_payload');
      const signature = 'test_signature';
      await expect(
        service.handleStripeWebhook(payload, signature),
      ).rejects.toThrow('Stripe Webhook secret not configured.');
    });

    it('should throw an error if the Stripe webhook signature is invalid', async () => {
      const payload = Buffer.from('test_payload');
      const signature = 'test_signature';
      mockStripWebhooksConstructEventAsync.mockRejectedValueOnce(
        new Error('Invalid signature'),
      );

      await expect(
        service.handleStripeWebhook(payload, signature),
      ).rejects.toThrow('Webhook Error: Invalid signature');
    });

    it('should handle a valid stripe webhook event', async () => {
      const payload = Buffer.from('test_payload');
      const signature = 'test_signature';
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'test_event_id',
          },
        },
      };
      mockStripWebhooksConstructEventAsync.mockResolvedValueOnce(mockEvent);

      await service.handleStripeWebhook(payload, signature);

      expect(mockStripWebhooksConstructEventAsync).toHaveBeenCalledWith(
        payload,
        signature,
        'test-webhook-key',
      );
      expect(mockQueueAdd).toHaveBeenCalledWith('process-event', {
        eventType: mockEvent.type,
        eventData: mockEvent.data.object,
      });
    });
  });
});
