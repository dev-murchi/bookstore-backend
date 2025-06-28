import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import {
  StripeWebhookProcessor,
  STRIPE_HANDLER_TOKEN,
} from './stripe-webhook-queue.processor';
import { StripeEvent } from '../../common/enum/stripe-event.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../../orders/orders.service';
import { OrderDTO } from '../../common/dto/order.dto';

const mockPrismaService = {
  $transaction: jest.fn((fn) => fn(mockPrismaService)),
};

const mockOrdersService = {
  getOrder: jest.fn(),
};

const getMockHandler = jest.fn();

describe('StripeWebhookProcessor', () => {
  let testModuleBuilder: TestingModuleBuilder;

  beforeEach(async () => {
    testModuleBuilder = Test.createTestingModule({
      providers: [
        {
          provide: STRIPE_HANDLER_TOKEN,
          useFactory: () => getMockHandler(),
        },
        StripeWebhookProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OrdersService, useValue: mockOrdersService },
      ],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', async () => {
    getMockHandler.mockReturnValue([]);

    const testModule: TestingModule = await testModuleBuilder.compile();
    const newProcessor = testModule.get(StripeWebhookProcessor);
    expect(newProcessor).toBeDefined();
  });

  describe('process', () => {
    let processor: StripeWebhookProcessor;

    const eventsToTest = [
      StripeEvent.PaymentIntentFailed,
      StripeEvent.CheckoutSessionExpired,
      StripeEvent.CheckoutSessionCompleted,
    ];

    const paymentIntentFailedHandler = {
      eventType: StripeEvent.PaymentIntentFailed,
      handle: jest.fn().mockResolvedValue({ success: true, log: null }),
    };
    const checkoutExpiredHandler = {
      eventType: StripeEvent.CheckoutSessionExpired,
      handle: jest.fn().mockResolvedValue({ success: true, log: null }),
    };
    const checkoutCompleteHandler = {
      eventType: StripeEvent.CheckoutSessionCompleted,
      handle: jest.fn().mockResolvedValue({ success: true, log: null }),
    };

    beforeEach(async () => {
      jest.clearAllMocks();

      getMockHandler.mockReturnValue([
        paymentIntentFailedHandler,
        checkoutExpiredHandler,
        checkoutCompleteHandler,
      ]);

      const module: TestingModule = await testModuleBuilder.compile();
      processor = module.get<StripeWebhookProcessor>(StripeWebhookProcessor);
      processor.onModuleInit();
    });

    it.each(eventsToTest)('should handle %s event', async (eventType) => {
      const orderId = 'order-uuid-999';
      const job: any = {
        data: {
          eventType,
          eventData: { metadata: { orderId } },
        },
        log: jest.fn(),
      };

      mockOrdersService.getOrder.mockResolvedValue({
        id: orderId,
      } as OrderDTO);

      const result = await processor.process(job);
      expect(result).toEqual({ success: true, log: null });
      expect(job.log).toHaveBeenCalledTimes(0);
    });

    it('should return error for unknown event type', async () => {
      const job: any = {
        data: { eventType: 'UNKNOWN_EVENT', eventData: {} },
      };

      const result = await processor.process(job);
      expect(result).toEqual({ success: false, log: 'Unknown event type' });
    });

    it('should return error if no handler is found', async () => {
      getMockHandler.mockReturnValue([]);
      const module = await testModuleBuilder.compile();
      processor = module.get(StripeWebhookProcessor);
      processor.onModuleInit();

      const job: any = {
        data: {
          eventType: StripeEvent.CheckoutSessionCompleted,
          eventData: {},
        },
      };

      const result = await processor.process(job);
      expect(result).toEqual({ success: false, log: 'No handler found' });
    });

    it('should return error if orderId is missing', async () => {
      const job: any = {
        data: {
          eventType: StripeEvent.PaymentIntentFailed,
          eventData: { metadata: {} },
        },
      };

      const result = await processor.process(job);
      expect(result).toEqual({
        success: false,
        log: 'Missing order ID in Stripe event metadata.',
      });
    });

    it('should return error if order not found', async () => {
      const orderId = 'order-uuid-999';
      const job: any = {
        data: {
          eventType: StripeEvent.PaymentIntentFailed,
          eventData: { metadata: { orderId } },
        },
        log: jest.fn(),
      };

      mockOrdersService.getOrder.mockResolvedValue(null);

      const result = await processor.process(job);
      expect(result).toEqual({
        success: false,
        log: `Order ${orderId} not found.`,
      });
      expect(job.log).toHaveBeenCalledWith(`Order ${orderId} not found.`);
    });

    it('should catch unexpected errors and throw a new error', async () => {
      const orderId = 'order-uuid-999';
      const job: any = {
        data: {
          eventType: StripeEvent.PaymentIntentFailed,
          eventData: { metadata: { orderId } },
        },
        log: jest.fn(),
      };

      mockOrdersService.getOrder.mockResolvedValue({
        id: orderId,
      } as OrderDTO);

      paymentIntentFailedHandler.handle.mockRejectedValueOnce(
        new Error('Handler error.'),
      );

      await expect(processor.process(job)).rejects.toThrow(
        `Failed to process Stripe event ${job.data.eventType}`,
      );
    });
  });

  describe('onInit', () => {
    const consoleSpy = jest.spyOn(console, 'warn');

    it('should log warning for missing handlers', async () => {
      getMockHandler.mockReturnValue([]);
      const expectedMessage =
        'No Stripe handlers found. Please ensure they are registered in the module providers with STRIPE_HANDLER_TOKEN.';

      const testModule: TestingModule = await testModuleBuilder.compile();
      const newProcessor = testModule.get(StripeWebhookProcessor);
      newProcessor.onModuleInit();

      expect(newProcessor['allStripeHandlers']).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(expectedMessage);
    });

    it('should log warning for handler without eventType', async () => {
      const handler = { handle: jest.fn() }; // no eventType
      getMockHandler.mockReturnValue([handler]);
      const expectedMessage =
        "Handler Object does not define an 'eventType' property. Skipping.";

      const testModule: TestingModule = await testModuleBuilder.compile();
      const newProcessor = testModule.get(StripeWebhookProcessor);
      newProcessor.onModuleInit();

      expect(newProcessor['allStripeHandlers']).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith(expectedMessage);
    });

    it('should log warning for duplicate handler', async () => {
      const eventType = StripeEvent.PaymentIntentFailed;
      const handler1 = {
        eventType,
        handle: jest.fn(),
      };
      const handler2 = {
        eventType,
        handle: jest.fn(),
      };

      getMockHandler.mockReturnValue([handler1, handler2]);
      const expectedMessage = `Duplicate handler registered for StripeEvent: ${eventType}. Overwriting with Object.`;

      const testModule: TestingModule = await testModuleBuilder.compile();
      const newProcessor = testModule.get(StripeWebhookProcessor);
      newProcessor.onModuleInit();

      expect(newProcessor['allStripeHandlers']).toHaveLength(2);
      expect(consoleSpy).toHaveBeenCalledWith(expectedMessage);
      expect(newProcessor['handlers'].size).toBe(1);
    });
  });
});
