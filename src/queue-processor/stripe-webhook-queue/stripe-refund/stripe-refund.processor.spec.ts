// import { Test, TestingModule } from '@nestjs/testing';
// import { StripeRefund } from './stripe-refund.processor';

// describe('StripeRefund', () => {
//   let provider: StripeRefund;

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [StripeRefund],
//     }).compile();

//     provider = module.get<StripeRefund>(StripeRefund);
//   });

//   it('should be defined', () => {
//     expect(provider).toBeDefined();
//   });
// });

import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import {
  StripeRefundProcessor,
  STRIPE_REFUND_HANDLER,
} from './stripe-refund.processor';
import { QueueService } from '../../../queue/queue.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrdersService } from '../../../orders/orders.service';
import { StripeEventTypeRefund } from '../../../common/types/stripe-event.type';
import Stripe from 'stripe';

const mockOrder = {
  id: 'order-uuid-1',
  owner: {
    name: 'test user',
    email: 'testuser@email.com',
  },
};

const mockHandler = {
  eventType: 'refund.created',
  handle: jest.fn().mockResolvedValue({ success: true, log: 'Refund handled' }),
};

const job = {
  name: 'refund.created' as StripeEventTypeRefund,
  data: {
    id: 're_abc',
    metadata: {
      orderId: 'order-uuid-1',
    },
  },
  log: jest.fn(),
} as unknown as Job<Stripe.Refund, any, StripeEventTypeRefund>;

const mockQueueService = {
  addOrderMailJob: jest.fn(),
};

const mockPrismaService = {
  $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
};
describe('StripeRefundProcessor', () => {
  let processor: StripeRefundProcessor;
  let queueService: QueueService;
  let ordersService: OrdersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StripeRefundProcessor,
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
          useValue: {
            getOrder: jest.fn().mockResolvedValue(mockOrder),
          },
        },
        {
          provide: STRIPE_REFUND_HANDLER,
          useValue: [mockHandler],
        },
      ],
    }).compile();

    processor = module.get(StripeRefundProcessor);
    queueService = module.get(QueueService);
    ordersService = module.get(OrdersService);

    // Init handler map
    processor.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should process refund job and return full result', async () => {
    const result = await processor.process(job);

    expect(result).toEqual({
      success: true,
      log: 'Refund handled',
      orderId: 'order-uuid-1',
      username: 'test user',
      email: 'testuser@email.com',
      refundId: 're_abc',
    });

    expect(mockHandler.handle).toHaveBeenCalledWith(job.data, mockOrder);
    expect(ordersService.getOrder).toHaveBeenCalledWith('order-uuid-1');
    expect(job.log).toHaveBeenCalledWith('Refund handled');
  });

  it('should send refund email when completed and template exists', async () => {
    const result = {
      success: true,
      orderId: 'order-uuid-1',
      username: 'test user',
      email: 'testuser@email.com',
      refundId: 're_abc',
    };

    await processor['onComplete'](job, result);

    expect(queueService.addOrderMailJob).toHaveBeenCalledWith('refundCreated', {
      orderId: result.orderId,
      email: result.email,
      username: result.username,
      refundId: result.refundId,
    });
  });

  it('should NOT send email if event name is not mapped', async () => {
    const jobWithUnknownEvent = {
      ...job,
      name: 'unknown.refund' as StripeEventTypeRefund,
    } as unknown as Job<Stripe.Refund, any, StripeEventTypeRefund>;

    const result = {
      success: true,
      orderId: 'order-uuid-1',
      username: 'test user',
      email: 'testuser@email.com',
      refundId: 're_abc',
    };

    await processor['onComplete'](jobWithUnknownEvent, result);

    expect(queueService.addOrderMailJob).not.toHaveBeenCalled();
  });

  it('should NOT send email if result.success is false', async () => {
    const result = {
      success: false,
      orderId: 'order-uuid-1',
      username: 'test user',
      email: 'testuser@email.com',
      refundId: 're_abc',
    };

    await processor['onComplete'](job, result);

    expect(queueService.addOrderMailJob).not.toHaveBeenCalled();
  });
});
