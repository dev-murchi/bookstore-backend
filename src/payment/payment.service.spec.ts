import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe/stripe.service';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus } from '../common/enum/payment-status.enum';

const mockStripeService = {
  createCheckoutSession: jest.fn(),
  constructWebhookEvent: jest.fn(),
};

const mockStripeWebhookQueue = {
  add: jest.fn(),
};

const mockPrismaService = {
  payment: { upsert: jest.fn() },
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
          provide: 'StripeWebhookQueue',
          useValue: mockStripeWebhookQueue,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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

      mockStripeService.constructWebhookEvent.mockResolvedValueOnce(mockEvent);

      await paymentService.handleStripeWebhook(payload, signature);

      expect(mockStripeService.constructWebhookEvent).toHaveBeenCalledWith(
        payload,
        signature,
      );
      expect(mockStripeWebhookQueue.add).toHaveBeenCalledWith('process-event', {
        eventType: mockEvent.type,
        eventData: mockEvent.data.object,
      });
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
  });

  describe('createOrUpdatePayment', () => {
    it('should create a new payment when the order does not exist', async () => {
      // Arrange
      const paymentData = {
        orderId: 'order-uuid-1',
        transactionId: 'pi_123',
        status: PaymentStatus.Paid,
        amount: 1000,
      };

      mockPrismaService.payment.upsert.mockResolvedValueOnce({
        id: 'payment-uuid-1',
        orderid: 'order-uuid-1',
        transaction_id: 'pi_123',
        status: 'paid',
        method: 'card',
        amount: 1000,
        payment_date: new Date(),
      });

      const receivedPayment =
        await paymentService.createOrUpdatePayment(paymentData);

      expect(mockPrismaService.payment.upsert).toHaveBeenCalledWith({
        where: { orderid: 'order-uuid-1' },
        update: { status: 'paid' },
        create: {
          transaction_id: 'pi_123',
          order: { connect: { id: 'order-uuid-1' } },
          status: 'paid',
          method: 'card',
          amount: 1000,
        },
      });

      expect(receivedPayment).toEqual({
        id: 'payment-uuid-1',
        transactionId: 'pi_123',
        status: 'paid',
        method: 'card',
        amount: 1000,
      });
    });

    it('should propagate error when Prisma throws an exception', async () => {
      const paymentData = {
        orderId: 'order-uuid-1',
        transactionId: 'pi_123',
        status: PaymentStatus.Paid,
        amount: 1000,
      };

      mockPrismaService.payment.upsert.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(
        paymentService.createOrUpdatePayment(paymentData),
      ).rejects.toThrow(
        new Error('An internal server error occurred. Please try again later.'),
      );
    });
  });
});
