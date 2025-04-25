import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';

import { OrdersStatusService } from './orders-status.service';
import { OrdersService } from './orders.service';

const mockOrdersService = {
  getOrder: jest.fn(),
  getAll: jest.fn(),
};
const mockOrdersStatusService = {
  deliverOrder: jest.fn(),
  shipOrder: jest.fn(),
  cancelOrder: jest.fn(),
};

describe('OrdersController', () => {
  let controller: OrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: OrdersStatusService, useValue: mockOrdersStatusService },
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
