import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { JwtAuthGuard } from '../common/guards/auth/jwt-auth.guard';
import { UserService } from '../user/user.service';
import { ReviewsService } from '../reviews/reviews.service';

const mockBookService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockUserService = {
  findBy: jest.fn(),
};

const mockReviewsService = {
  createReview: jest.fn(),
  getReviews: jest.fn(),
};

describe('BooksController', () => {
  let controller: BooksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        {
          provide: BooksService,
          useValue: mockBookService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: ReviewsService,
          useValue: mockReviewsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        handleRequest: jest.fn(),
      })
      .compile();

    controller = module.get<BooksController>(BooksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
