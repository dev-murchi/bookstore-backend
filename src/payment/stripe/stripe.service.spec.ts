import { Test, TestingModule } from '@nestjs/testing';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

const mockStripeCheckoutSessionsCreateFunc = jest.fn();
const mockStripWebhooksConstructEventAsync = jest.fn();
const mockStripRefundsCreateFunc = jest.fn();

// Mock the Stripe class
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
      refunds: {
        create: mockStripRefundsCreateFunc,
      },
    })),
  };
});

// Mock the ConfigService
const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'stripe.apiKey') return 'test-api-key';
    if (key === 'stripe.whKey') return 'test-webhook-key';
    return null;
  }),
};

describe('StripeService', () => {
  let stripeService: StripeService;
  let stripe: jest.Mocked<Stripe>;

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Create a testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    // Get the instance of the service and the mocked Stripe instance
    stripeService = module.get<StripeService>(StripeService);
    stripe = new Stripe('test-api-key') as jest.Mocked<Stripe>;
    stripeService['stripe'] = stripe; // Inject the mocked Stripe instance
  });

  it('should be defined', () => {
    expect(stripeService).toBeDefined();
  });

  describe('createCheckoutSession', () => {
    it('should call stripe.checkout.sessions.create with correct parameters', async () => {
      // Arrange
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: 'Test Product' },
              unit_amount: 1000,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: 'https://success.com',
        cancel_url: 'https://cancel.com',
      };

      const mockSession = { id: 'session_id' };
      mockStripeCheckoutSessionsCreateFunc.mockResolvedValueOnce(mockSession);

      // Act
      const result = await stripeService.createCheckoutSession(sessionParams);

      // Assert
      expect(mockStripeCheckoutSessionsCreateFunc).toHaveBeenCalledWith(
        sessionParams,
      );
      expect(result).toEqual(mockSession);
    });
  });

  describe('constructWebhookEvent', () => {
    it('should call stripe.webhooks.constructEventAsync with correct parameters', async () => {
      // Arrange
      const payload = Buffer.from('payload');
      const signature = 'signature';

      const mockEvent = { id: 'event_id', type: 'payment_intent.succeeded' };
      mockStripWebhooksConstructEventAsync.mockResolvedValueOnce(mockEvent);

      // Act
      const result = await stripeService.constructWebhookEvent(
        payload,
        signature,
      );

      // Assert
      expect(mockStripWebhooksConstructEventAsync).toHaveBeenCalledWith(
        payload,
        signature,
        'test-webhook-key',
      );
      expect(result).toEqual(mockEvent);
    });

    it('should throw an error if webhook secret is not configured', async () => {
      // Arrange
      stripeService['stripeWebhookKey'] = ''; // Simulate missing webhook secret

      const payload = Buffer.from('payload');
      const signature = 'signature';

      // Act & Assert
      await expect(
        stripeService.constructWebhookEvent(payload, signature),
      ).rejects.toThrow('Stripe Webhook secret not configured.');
    });

    it('should throw an error if constructing webhook event fails', async () => {
      // Arrange
      const payload = Buffer.from('payload');
      const signature = 'signature';

      mockStripWebhooksConstructEventAsync.mockRejectedValueOnce(
        new Error('Invalid signature'),
      );

      // Act & Assert
      await expect(
        stripeService.constructWebhookEvent(payload, signature),
      ).rejects.toThrow('Webhook Error: Invalid signature');
    });
  });

  describe('createRefundForPayment', () => {
    it('should call stripe.refunds.create with the correct payment intent', async () => {
      // Arrange
      const paymentIntent = 'pi_123';
      const mockRefund = { id: 're_123', status: 'succeeded' };
      mockStripRefundsCreateFunc.mockResolvedValueOnce(mockRefund);

      // Act
      const result = await stripeService.createRefundForPayment(paymentIntent);

      // Assert
      expect(mockStripRefundsCreateFunc).toHaveBeenCalledWith({
        payment_intent: paymentIntent,
      });
      expect(result).toEqual(mockRefund);
    });
  });
});
