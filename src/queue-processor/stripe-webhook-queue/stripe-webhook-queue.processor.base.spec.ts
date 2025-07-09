import { Test } from '@nestjs/testing';
import { Job } from 'bullmq';
import { OrdersService } from '../../orders/orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeEvent } from '../../common/enum/stripe-event.enum';
import { StripeWebhookProcessorBase } from './stripe-webhook-queue.processor.base';

describe('StripeWebhookProcessorBase', () => {
  const mockOrder = {
    id: 'order123',
    owner: { name: 'Test', email: 'test@example.com' },
  };

  const mockHandler = {
    eventType: StripeEvent.CheckoutSessionCompleted,
    handle: jest.fn(),
  };

  const baseJob = {
    name: StripeEvent.CheckoutSessionCompleted,
    data: {
      metadata: {
        orderId: 'order123',
      },
    },
    log: jest.fn(),
  } as unknown as Job;

  class TestProcessor extends StripeWebhookProcessorBase<any, any> {
    async process(job: Job<any, any, any>) {
      return this.processJob(job);
    }
  }

  let processor: TestProcessor;
  let prisma: PrismaService;
  let ordersService: OrdersService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TestProcessor,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((cb) => cb()),
          },
        },
        {
          provide: OrdersService,
          useValue: {
            getOrder: jest.fn().mockResolvedValue(mockOrder),
          },
        },
      ],
    })
      .overrideProvider(TestProcessor)
      .useFactory({
        factory: (prisma: PrismaService, ordersService: OrdersService) =>
          new TestProcessor(prisma, ordersService, [mockHandler]),
        inject: [PrismaService, OrdersService],
      })
      .compile();

    processor = moduleRef.get(TestProcessor);
    prisma = moduleRef.get(PrismaService);
    ordersService = moduleRef.get(OrdersService);

    processor.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should register handler', () => {
      expect((processor as any).handlers.size).toBe(1);
    });

    it('should warn if no handlers provided', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const testProcessor = new TestProcessor(prisma, ordersService, []);
      testProcessor.onModuleInit();
      expect(warnSpy).toHaveBeenCalledWith('No Stripe handlers found.');
      warnSpy.mockRestore();
    });

    it('should warn and skip handler without eventType', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const handlerWithoutEventType = {
        handle: jest.fn(),
        constructor: { name: 'NoEventTypeHandler' },
      };

      const testProcessor = new TestProcessor(prisma, ordersService, [
        handlerWithoutEventType as any,
      ]);

      testProcessor.onModuleInit();

      expect(warnSpy).toHaveBeenCalledWith(
        `Handler NoEventTypeHandler does not define an 'eventType' property. Skipping.`,
      );
      expect((testProcessor as any).handlers.size).toBe(0);

      warnSpy.mockRestore();
    });

    it('should warn on duplicate handler registration', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const testProcessor = new TestProcessor(prisma, ordersService, [
        mockHandler,
        mockHandler,
      ]);
      testProcessor.onModuleInit();
      expect(warnSpy).toHaveBeenCalledWith(
        `Overwriting handler for ${mockHandler.eventType}`,
      );
      warnSpy.mockRestore();
    });
  });

  describe('processJob', () => {
    it('should return success when handler resolves', async () => {
      mockHandler.handle.mockResolvedValueOnce({ success: true, log: 'ok' });

      const result = await processor.process(baseJob);
      expect(result).toEqual({ success: true, log: 'ok' });
      expect(mockHandler.handle).toHaveBeenCalledWith(baseJob.data, mockOrder);
      expect(baseJob.log).toHaveBeenCalledWith('ok');
    });

    it('should fail on unknown event type', async () => {
      const result = await processor.process({
        ...baseJob,
        name: 'unknown.event',
      } as Job);
      expect(result).toEqual({ success: false, log: 'Unknown event type' });
    });

    it('should fail if handler is missing for known event', async () => {
      const job = {
        ...baseJob,
        name: StripeEvent.RefundFailed,
      } as Job;
      const result = await processor.process(job);
      expect(result).toEqual({ success: false, log: 'No handler found' });
    });

    it('should fail if orderId is missing in metadata', async () => {
      const job = {
        ...baseJob,
        data: { metadata: {} },
      } as Job;
      const result = await processor.process(job);
      expect(result).toEqual({ success: false, log: 'Missing order ID' });
    });

    it('should fail if order is not found', async () => {
      jest.spyOn(ordersService, 'getOrder').mockResolvedValueOnce(null);
      const result = await processor.process(baseJob);
      expect(result).toEqual({
        success: false,
        log: 'Order order123 not found',
      });
    });
  });
});
