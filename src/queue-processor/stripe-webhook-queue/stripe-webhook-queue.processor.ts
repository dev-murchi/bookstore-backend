import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, OnModuleInit } from '@nestjs/common';
import { StripeEvent } from '../../common/enum/stripe-event.enum';
import { StripeHandler } from '../../common/types/stripe-handler.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../../orders/orders.service';

export const STRIPE_HANDLER_TOKEN = 'STRIPE_HANDLER_TOKEN';

@Processor('stripe-webhook-queue')
export class StripeWebhookProcessor extends WorkerHost implements OnModuleInit {
  private readonly handlers = new Map<StripeEvent, StripeHandler>();

  constructor(
    @Inject(STRIPE_HANDLER_TOKEN)
    private readonly allStripeHandlers: StripeHandler[],
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {
    super();
  }
  onModuleInit() {
    if (!this.allStripeHandlers || this.allStripeHandlers.length === 0) {
      console.warn(
        'No Stripe handlers found. Please ensure they are registered in the module providers with STRIPE_HANDLER_TOKEN.',
      );
      return;
    }

    for (const handler of this.allStripeHandlers) {
      const eventType = handler.eventType;

      if (!eventType) {
        console.warn(
          `Handler ${handler.constructor.name} does not define an 'eventType' property. Skipping.`,
        );
        continue;
      }

      if (this.handlers.has(eventType)) {
        console.warn(
          `Duplicate handler registered for StripeEvent: ${eventType}. Overwriting with ${handler.constructor.name}.`,
        );
      }
      this.handlers.set(eventType, handler);
    }
    console.log(`Initialized with ${this.handlers.size} handlers.`);
  }

  async process(job: Job): Promise<any> {
    const { eventType, eventData } = job.data;

    if (!Object.values(StripeEvent).includes(eventType as StripeEvent)) {
      console.warn(
        `Received unknown Stripe event type: ${eventType}. Skipping.`,
      );
      return Promise.resolve({ success: false, log: 'Unknown event type' });
    }

    const handler = this.handlers.get(eventType as StripeEvent);
    if (!handler) {
      console.error(
        `[StripeWebhookProcessor] No handler registered for eventType: ${eventType}`,
      );
      return Promise.resolve({ success: false, log: 'No handler found' });
    }

    try {
      const orderId = eventData.metadata['orderId'];

      if (!orderId) {
        return Promise.resolve({
          success: false,
          log: 'Missing order ID in Stripe event metadata.',
        });
      }

      const { success, log } = await this.prisma.$transaction(async () => {
        const order = await this.ordersService.getOrder(orderId);
        if (!order) {
          return {
            success: false,
            log: `Order ${orderId} not found.`,
          };
        }

        return await handler.handle(eventData, order);
      });

      if (log) {
        job.log(log);
      }

      return Promise.resolve({ success, log });
    } catch (error: any) {
      console.error(
        `[StripeWebhookProcessor] Failed to process ${eventType}. Error:`,
        error,
      );

      throw new Error(`Failed to process Stripe event ${eventType}`);
    }
  }
}
