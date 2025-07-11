import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe/stripe.service';
import Stripe from 'stripe';
import { QueueService } from 'src/queue/queue.service';

const mockStripeService = {
  createCheckoutSession: jest.fn(),
  constructWebhookEvent: jest.fn(),
};

const mockQueueService = {
  addStripePaymentJob: jest.fn(),
  addStripeCheckoutJob: jest.fn(),
  addStripeRefundJob: jest.fn(),
};

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    // Get instances of the service and the mocked dependencies
    paymentService = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(paymentService).toBeDefined();
  });

  describe('createCheckoutSession', () => {
    it('should call mockStripeService.createCheckoutSession and return the correct session URL and expiration', async () => {
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

      const mockSession = {
        url: 'https://checkout.stripe.com/session/123',
        expires_at: 1633046400,
      } as Stripe.Response<Stripe.Checkout.Session>;

      mockStripeService.createCheckoutSession.mockResolvedValueOnce(
        mockSession,
      );

      const result =
        await paymentService.createStripeCheckoutSession(sessionParams);

      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        sessionParams,
      );
      expect(result).toEqual({
        url: mockSession.url,
        expires: mockSession.expires_at,
      });
    });
    it('shoudld throw an error when stripe session creation fails', async () => {
      mockStripeService.createCheckoutSession.mockRejectedValueOnce(
        new Error('Stripe checkoput creation error.'),
      );

      await expect(
        paymentService.createStripeCheckoutSession({}),
      ).rejects.toThrow('Stripe checkout session creation failed.');
    });
  });

  describe('handleStripeWebhook', () => {
    it('should handle the stripe webhook event and add it to the queue', async () => {
      const payload = Buffer.from('test-payload');
      const signature = 'test-signature';
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      } as Stripe.Event;

      const consoleErrorSpy = jest.spyOn(console, 'error');

      mockStripeService.constructWebhookEvent.mockResolvedValueOnce(mockEvent);

      await paymentService.handleStripeWebhook(payload, signature);

      expect(mockStripeService.constructWebhookEvent).toHaveBeenCalledWith(
        payload,
        signature,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Unknown Stripe event type:',
        mockEvent.type,
      );

      consoleErrorSpy.mockRestore();
    });

    it('should throw an error if webhook event construction fails', async () => {
      const payload = Buffer.from('test-payload');
      const signature = 'test-signature';
      mockStripeService.constructWebhookEvent.mockRejectedValueOnce(
        new Error('Invalid signature'),
      );

      await expect(
        paymentService.handleStripeWebhook(payload, signature),
      ).rejects.toThrow('Webhook Error: Invalid signature');
    });

    it('should add stripe payment job for payment_intent.payment_failed event', async () => {
      const payload = Buffer.from('payment_intent');
      const signature = 'test-signature';

      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_test' } },
      } as Stripe.Event;

      mockStripeService.constructWebhookEvent.mockResolvedValueOnce(mockEvent);

      await paymentService.handleStripeWebhook(payload, signature);

      expect(mockQueueService.addStripePaymentJob).toHaveBeenCalledWith({
        eventType: 'payment_intent.payment_failed',
        eventData: { id: 'pi_test' },
      });
    });

    it('should add stripe checkout job for checkout.session.completed event', async () => {
      const payload = Buffer.from('checkout_session');
      const signature = 'test-signature';

      const mockEvent = {
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test' } },
      } as Stripe.Event;

      mockStripeService.constructWebhookEvent.mockResolvedValueOnce(mockEvent);

      await paymentService.handleStripeWebhook(payload, signature);

      expect(mockQueueService.addStripeCheckoutJob).toHaveBeenCalledWith({
        eventType: 'checkout.session.completed',
        eventData: { id: 'cs_test' },
      });
    });

    it('should add stripe refund job for refund.updated event', async () => {
      const payload = Buffer.from('refund');
      const signature = 'test-signature';

      const mockEvent = {
        type: 'refund.updated',
        data: { object: { id: 're_test' } },
      } as Stripe.Event;

      mockStripeService.constructWebhookEvent.mockResolvedValueOnce(mockEvent);

      await paymentService.handleStripeWebhook(payload, signature);

      expect(mockQueueService.addStripeRefundJob).toHaveBeenCalledWith({
        eventType: 'refund.updated',
        eventData: { id: 're_test' },
      });
    });

    it('should throw generic error if a non-Error value is thrown', async () => {
      const payload = Buffer.from('test-payload');
      const signature = 'test-signature';

      // Throw something that's *not* an instance of Error
      mockStripeService.constructWebhookEvent.mockImplementation(() => {
        throw 'Non-error string thrown';
      });

      await expect(
        paymentService.handleStripeWebhook(payload, signature),
      ).rejects.toThrow('Webhook Error: Unexpected error');
    });
  });
});
