import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import {
  STRIPE_PAYMENT_HANDLER,
  StripePaymentProcessor,
} from './stripe-payment.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrdersService } from '../../../orders/orders.service';
import { StripeEventTypePaymentIntent } from '../../../common/types/stripe-event.type';
import Stripe from 'stripe';

const mockPrismaService = {
  $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
};

const mockOrdersService = {
  getOrder: jest.fn(),
};

const mockHandler = {
  eventType: 'payment_intent.payment_failed',
  handle: jest
    .fn()
    .mockResolvedValue({ success: true, log: 'Payment processed' }),
};
const mockOrder = {
  id: 'order-uuid-1',
  owner: { name: 'test user', email: 'testuser@email.com' },
};
const jobData = {
  id: 'pi_123',
  metadata: {
    orderId: mockOrder.id,
  },
} as unknown as Stripe.PaymentIntent;

const mockJob = {
  name: 'payment_intent.payment_failed' as StripeEventTypePaymentIntent,
  data: jobData,
  log: jest.fn(),
} as unknown as Job<Stripe.PaymentIntent, any, StripeEventTypePaymentIntent>;

describe('StripePaymentProcessor', () => {
  let processor: StripePaymentProcessor;
  let mockOrders: OrdersService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StripePaymentProcessor,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: STRIPE_PAYMENT_HANDLER,
          useValue: [mockHandler],
        },
      ],
    }).compile();

    processor = moduleRef.get(StripePaymentProcessor);
    processor.onModuleInit();
    mockOrders = moduleRef.get(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.only('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it.only('should process a payment job successfully', async () => {
    mockOrdersService.getOrder.mockResolvedValueOnce(mockOrder);

    const result = await processor.process(mockJob);

    expect(result).toEqual({ success: true, log: 'Payment processed' });
    expect(mockHandler.handle).toHaveBeenCalledWith(jobData, mockOrder);
    expect(mockJob.log).toHaveBeenCalledWith('Payment processed');
  });

  it.only('should return failure for unknown event type', async () => {
    const unknownJob = {
      ...mockJob,
      name: 'nonexistent_event',
    } as unknown as Job<
      Stripe.PaymentIntent,
      any,
      StripeEventTypePaymentIntent
    >;

    const result = await processor.process(unknownJob);
    expect(result).toEqual({ success: false, log: 'Unknown event type' });
  });

  it.only('should return failure for missing handler', async () => {
    processor['handlers'].delete(mockJob.name as any);
    const result = await processor.process(mockJob);
    expect(result).toEqual({ success: false, log: 'No handler found' });
  });

  it.only('should return failure for missing order ID', async () => {
    const badJob = {
      ...mockJob,
      data: {
        metadata: {},
      },
    } as unknown as Job<
      Stripe.PaymentIntent,
      any,
      StripeEventTypePaymentIntent
    >;

    const result = await processor.process(badJob);
    expect(result).toEqual({ success: false, log: 'Missing order ID' });
  });

  it.only('should return failure when order not found', async () => {
    jest.spyOn(mockOrders, 'getOrder').mockResolvedValueOnce(null);
    const orderId = mockJob.data.metadata['orderId'];
    const result = await processor.process(mockJob);
    expect(result).toEqual({
      success: false,
      log: `Order ${orderId} not found`,
    });
  });
});
