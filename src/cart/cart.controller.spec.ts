import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartGuard } from './guards/cart.guard';
import { CheckoutService } from './checkout/checkout.service';
import { CartItemService } from './cart-item.service';

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
const mockCartItemService = {
  createOrUpdateItem: jest.fn(),
  deleteItem: jest.fn(),
};

describe('CartController', () => {
  let controller: CartController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: CartService, useValue: mockCartService },
        { provide: CheckoutService, useValue: mockCheckoutService },
        { provide: CartItemService, useValue: mockCartItemService },
      ],
    })
      .overrideGuard(CartGuard)
      .useValue({
        handleRequest: jest.fn(),
      })
      .compile();

    controller = module.get<CartController>(CartController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
