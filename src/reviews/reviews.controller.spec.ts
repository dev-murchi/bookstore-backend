import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
const mockReviewsService = {
  create: jest.fn(),
};
describe('ReviewsController', () => {
  let controller: ReviewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: mockReviewsService }],
    })
      .overrideGuard(UserAccessGuard)
      .useValue({
        canActivate: jest.fn(),
      })
      .compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
