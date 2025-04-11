import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';

const mockCheckoutService = {
  checkout: jest.fn(),
};

describe('CheckoutController', () => {
  let controller: CheckoutController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheckoutController],
      providers: [{ provide: CheckoutService, useValue: mockCheckoutService }],
    })
      .overrideGuard(UserAccessGuard)
      .useValue({
        canActivate: jest.fn(),
      })
      .compile();

    controller = module.get<CheckoutController>(CheckoutController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
