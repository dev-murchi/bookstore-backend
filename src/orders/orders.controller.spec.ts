import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';

import { OrdersStatusService } from './orders-status.service';
import { OrdersService } from './orders.service';
import { StripeService } from 'src/payment/stripe/stripe.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { QueueService } from 'src/queue/queue.service';

const mockOrdersService = {
  getOrder: jest.fn(),
  getAll: jest.fn(),
};
const mockOrdersStatusService = {
  deliverOrder: jest.fn(),
  shipOrder: jest.fn(),
  cancelOrder: jest.fn(),
};

const mockQueueService = {
  addOrderMailJob: jest.fn(),
};

const mockStripeService = {
  createRefundForPayment: jest.fn(),
};

describe('OrdersController', () => {
  let controller: OrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: OrdersStatusService, useValue: mockOrdersStatusService },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        { provide: StripeService, useValue: mockStripeService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        handleRequest: jest.fn(),
      })
      .compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
