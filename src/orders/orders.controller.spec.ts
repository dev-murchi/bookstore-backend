import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';

import { OrdersStatusService } from './orders-status.service';
import { OrdersService } from './orders.service';
import { EmailService } from '../email/email.service';
import { StripeService } from '../payment/stripe/stripe.service';

const mockOrdersService = {
  getOrder: jest.fn(),
  getAll: jest.fn(),
};
const mockOrdersStatusService = {
  deliverOrder: jest.fn(),
  shipOrder: jest.fn(),
  cancelOrder: jest.fn(),
};

const mockEmailService = {
  sendOrderStatusUpdate: jest.fn(),
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
          provide: EmailService,
          useValue: mockEmailService,
        },
        { provide: StripeService, useValue: mockStripeService },
      ],
    })
      .overrideGuard(UserAccessGuard)
      .useValue({
        canActivate: jest.fn(),
      })
      .compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
