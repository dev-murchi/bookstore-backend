import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthGuard } from '../common/guards/auth/auth.guard';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { ReviewsService } from '../reviews/reviews.service';
import { OrdersService } from '../orders/orders.service';

const mockUserService = {
  findOne: jest.fn(),
};

const mockReviewsService = {
  getReviewsForUser: jest.fn(),
};
const mockOrdersService = {
  getUserOrders: jest.fn(),
};

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: ReviewsService, useValue: mockReviewsService },
        { provide: OrdersService, useValue: mockOrdersService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: jest.fn(),
      })
      .overrideGuard(UserAccessGuard)
      .useValue({
        canActivate: jest.fn(),
      })
      .compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
