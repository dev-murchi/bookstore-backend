import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { CheckoutService } from './checkout/checkout.service';

const mockCartService = {
  createCart: jest.fn(),
  findCart: jest.fn(),
  upsertItem: jest.fn(),
  upsertItems: jest.fn(),
  removeItem: jest.fn(),
  removeItems: jest.fn(),
};

const mockCheckoutService = {
  checkout: jest.fn(),
};

describe('CartController', () => {
  let controller: CartController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: CartService, useValue: mockCartService },
        { provide: CheckoutService, useValue: mockCheckoutService },
      ],
    })
      .overrideGuard(UserAccessGuard)
      .useValue({
        canActivate: jest.fn(),
      })
      .compile();

    controller = module.get<CartController>(CartController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
