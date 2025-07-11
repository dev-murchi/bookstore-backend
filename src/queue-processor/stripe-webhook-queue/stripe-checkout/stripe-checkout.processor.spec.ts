import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import {
  StripeCheckoutProcessor,
  STRIPE_CHECKOUT_SESSION_HANDLER,
} from './stripe-checkout.processor';
import { QueueService } from 'src/queue/queue.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrdersService } from 'src/orders/orders.service';
import { StripeEventTypeCheckout } from 'src/common/types/stripe-event.type';
import { OrderStatus } from 'src/common/enum/order-status.enum';
import Stripe from 'stripe';

const mockQueueService = {
  addOrderMailJob: jest.fn(),
};

const mockPrismaService = {
  $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
};

const mockOrdersService = {
  getOrder: jest.fn(), //.mockResolvedValue(mockOrder),
};

const mockOrder = {
  id: 'order-uuid-1',
  status: OrderStatus.Pending,
  owner: {
    name: 'test user',
    email: 'testuser@email.com',
  },
};

const mockHandler = {
  eventType: 'checkout.session.completed',
  handle: jest
    .fn()
    .mockResolvedValue({ success: true, log: 'Handled successfully' }),
};

const job = {
  name: 'checkout.session.completed' as StripeEventTypeCheckout,
  data: {
    id: 'evt_001',
    metadata: {
      orderId: 'order-uuid-1',
    },
  },
  log: jest.fn(),
} as unknown as Job<Stripe.Checkout.Session, any, StripeEventTypeCheckout>;

describe('StripeCheckoutProcessor', () => {
  let processor: StripeCheckoutProcessor;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StripeCheckoutProcessor,
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: STRIPE_CHECKOUT_SESSION_HANDLER,
          useValue: [mockHandler],
        },
      ],
    }).compile();

    processor = module.get(StripeCheckoutProcessor);

    processor.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should process the job and return enriched result', async () => {
    mockOrdersService.getOrder
      .mockResolvedValueOnce(mockOrder)
      .mockResolvedValueOnce({ ...mockOrder, status: OrderStatus.Complete });
    const result = await processor.process(job);

    expect(result).toEqual({
      success: true,
      log: 'Handled successfully',
      orderId: 'order-uuid-1',
      username: 'test user',
      email: 'testuser@email.com',
    });

    expect(mockHandler.handle).toHaveBeenCalledWith(job.data, mockOrder);
    expect(mockOrdersService.getOrder).toHaveBeenCalledWith('order-uuid-1');
    expect(job.log).toHaveBeenCalledWith('Handled successfully');
  });

  it('should enqueue email on job completion if template key exists', async () => {
    const result = {
      success: true,
      orderId: 'order-uuid-1',
      email: 'testuser@email.com',
      username: 'test user',
      log: 'Handled successfully',
    };

    await processor['onComplete'](job, result);

    expect(mockQueueService.addOrderMailJob).toHaveBeenCalledWith(
      'orderComplete',
      {
        orderId: 'order-uuid-1',
        email: 'testuser@email.com',
        username: 'test user',
      },
    );
  });

  it('should not enqueue email if template key does not exist', async () => {
    const jobWithUnknownEvent = {
      ...job,
      name: 'unknown.event' as StripeEventTypeCheckout,
    } as unknown as Job<Stripe.Checkout.Session, any, StripeEventTypeCheckout>;

    const result = {
      success: true,
      log: null,
      orderId: 'order-uuid-1',
      email: 'testuser@email.com',
      username: 'test user',
    };

    await processor['onComplete'](jobWithUnknownEvent, result);

    expect(mockQueueService.addOrderMailJob).not.toHaveBeenCalled();
  });

  it('should not enqueue email if result is not successful', async () => {
    const result = {
      success: false,
      log: 'Unknown event type',
      orderId: 'order-uuid-1',
      email: 'testuser@email.com',
      username: 'test user',
    };

    await processor['onComplete'](job, result);

    expect(mockQueueService.addOrderMailJob).not.toHaveBeenCalled();
  });
});
