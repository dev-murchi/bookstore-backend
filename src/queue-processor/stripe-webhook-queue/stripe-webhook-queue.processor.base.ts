import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { StripeEvent } from '../../common/enum/stripe-event.enum';
import { StripeHandler } from '../../common/types/stripe-handler.interface';
import { OrdersService } from '../../orders/orders.service';
import { PrismaService } from '../../prisma/prisma.service';

export abstract class StripeWebhookProcessorBase<
  TJob,
  TEvent extends string,
> extends WorkerHost {
  protected handlers = new Map<StripeEvent, StripeHandler>();

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly ordersService: OrdersService,
    protected readonly allStripeHandlers: StripeHandler[],
  ) {
    super();
  }

  onModuleInit() {
    if (!this.allStripeHandlers || this.allStripeHandlers.length === 0) {
      console.warn('No Stripe handlers found.');
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
        console.warn(`Overwriting handler for ${eventType}`);
      }
      this.handlers.set(eventType, handler);
    }
    console.log(
      `Initialized with ${this.handlers.size} handlers in ${this.constructor.name}.`,
    );
  }

  protected async processJob(
    job: Job<TJob, any, TEvent>,
  ): Promise<{ success: boolean; log: string | null }> {
    const eventData = job.data as any;
    const eventType = job.name as StripeEvent;
    console.log({ eventType, h: this.allStripeHandlers.length });

    if (!Object.values(StripeEvent).includes(eventType)) {
      return { success: false, log: 'Unknown event type' };
    }

    const handler = this.handlers.get(eventType);
    if (!handler) {
      return { success: false, log: 'No handler found' };
    }

    const orderId = eventData.metadata?.orderId;
    if (!orderId) return { success: false, log: 'Missing order ID' };

    const order = await this.ordersService.getOrder(orderId);
    if (!order) return { success: false, log: `Order ${orderId} not found` };

    const { success, log } = await this.prisma.$transaction(() =>
      handler.handle(eventData, order),
    );

    if (log) job.log(log);

    return {
      success,
      log,
    };
  }
}
