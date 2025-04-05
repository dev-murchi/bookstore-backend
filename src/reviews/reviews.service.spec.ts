import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDTO } from './dto/create-review.dto';
import { Prisma } from '@prisma/client';

const mockPrismaService = {
  reviews: {
    create: jest.fn(),
  },
};
describe('ReviewsService', () => {
  let service: ReviewsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const userId = 1;
    const createReviewDTO: CreateReviewDTO = {
      bookId: 10,
      data: 'This is a great book!',
      rating: 5,
    };

    it('should successfully create a review', async () => {
      mockPrismaService.reviews.create.mockResolvedValueOnce({});

      const result = await service.create(userId, createReviewDTO);

      expect(mockPrismaService.reviews.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { id: userId } },
          book: { connect: { id: createReviewDTO.bookId } },
          data: createReviewDTO.data,
          rating: createReviewDTO.rating,
        },
      });
      expect(result).toEqual({ message: 'Review created.' });
    });

    it('should throw an error if the user has already reviewed the book', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`userId`,`bookId`)',
        {
          code: 'P2002',
        } as any,
      );
      mockPrismaService.reviews.create.mockRejectedValueOnce(prismaError);

      await expect(service.create(userId, createReviewDTO)).rejects.toThrow(
        'User can create only one review per book.',
      );
      expect(mockPrismaService.reviews.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { id: userId } },
          book: { connect: { id: createReviewDTO.bookId } },
          data: createReviewDTO.data,
          rating: createReviewDTO.rating,
        },
      });
    });

    it('should throw an error if the book is not found', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'An operation failed because it depends on one or more records that were required but not found.',
        {
          code: 'P2025',
        } as any,
      );
      mockPrismaService.reviews.create.mockRejectedValue(prismaError);

      await expect(service.create(userId, createReviewDTO)).rejects.toThrow(
        `Book #${createReviewDTO.bookId} or is not found`,
      );
      expect(mockPrismaService.reviews.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { id: userId } },
          book: { connect: { id: createReviewDTO.bookId } },
          data: createReviewDTO.data,
          rating: createReviewDTO.rating,
        },
      });
    });

    it('should throw generic error for unknown error types', async () => {
      const error = new Error('Unknown database error');
      mockPrismaService.reviews.create.mockRejectedValueOnce(error);

      await expect(
        service.create(userId, createReviewDTO),
      ).rejects.toThrowError('Review creation failed.');
    });
  });
});
