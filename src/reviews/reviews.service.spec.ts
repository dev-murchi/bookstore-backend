import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDTO } from './dto/create-review.dto';
import { Prisma } from '@prisma/client';
import { CustomAPIError } from '../common/errors/custom-api.error';

const mockPrismaService = {
  books: { findUnique: jest.fn() },
  reviews: {
    create: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
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
    const createReviewDTO: CreateReviewDTO = {
      bookId: 10,
      data: 'This is a great book!',
      rating: 5,
    };

    it('should successfully create a review', async () => {
      mockPrismaService.books.findUnique.mockResolvedValueOnce({ id: 1 });
      mockPrismaService.reviews.create.mockResolvedValueOnce({});

      const result = await service.create('user-1', createReviewDTO);

      expect(mockPrismaService.reviews.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { userid: 'user-1' } },
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
      mockPrismaService.books.findUnique.mockResolvedValueOnce({ id: 1 });
      mockPrismaService.reviews.create.mockRejectedValueOnce(prismaError);

      try {
        await service.create('user-1', createReviewDTO);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('User can create only one review per book.');
        expect(mockPrismaService.reviews.create).toHaveBeenCalledWith({
          data: {
            user: { connect: { userid: 'user-1' } },
            book: { connect: { id: createReviewDTO.bookId } },
            data: createReviewDTO.data,
            rating: createReviewDTO.rating,
          },
        });
      }
    });

    it('should throw an error if the book is not purchased', async () => {
      mockPrismaService.books.findUnique.mockResolvedValueOnce(null);

      try {
        await service.create('user-1', createReviewDTO);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe(
          'Please purchase the book to leave a review.',
        );
      }
    });

    it('should throw an error if the book is not found', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'An operation failed because it depends on one or more records that were required but not found.',
        {
          code: 'P2025',
        } as any,
      );

      mockPrismaService.books.findUnique.mockResolvedValueOnce({ id: 1 });
      mockPrismaService.reviews.create.mockRejectedValueOnce(prismaError);

      try {
        await service.create('user-1', createReviewDTO);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe(
          `Book #${createReviewDTO.bookId} or is not found`,
        );

        expect(mockPrismaService.reviews.create).toHaveBeenCalledWith({
          data: {
            user: { connect: { userid: 'user-1' } },
            book: { connect: { id: createReviewDTO.bookId } },
            data: createReviewDTO.data,
            rating: createReviewDTO.rating,
          },
        });
      }
    });

    it('should throw generic error for unknown error types', async () => {
      const error = new Error('Unknown database error');
      mockPrismaService.books.findUnique.mockResolvedValueOnce({ id: 1 });
      mockPrismaService.reviews.create.mockRejectedValueOnce(error);

      try {
        await service.create('user-1', createReviewDTO);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Review creation failed.');
      }
    });
  });

  describe('findReviewsForBook', () => {
    const bookId = 1;
    const defaultPage = 1;
    const defaultLimit = 10;

    it('should successfully fetch paginated reviews with default parameters and calculate metadata', async () => {
      const mockReviews = [
        { rating: 5, data: 'Excellent book!' },
        { rating: 4, data: 'Good read.' },
      ];
      const mockAggregateResult = { _avg: { rating: 4.5 } };
      const mockTotalReviewCount = 25;

      mockPrismaService.reviews.findMany.mockResolvedValue(mockReviews);
      mockPrismaService.reviews.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.reviews.count.mockResolvedValue(mockTotalReviewCount);

      const result = await service.findReviewsForBook(bookId);

      expect(mockPrismaService.reviews.findMany).toHaveBeenCalledWith({
        where: { book: { id: bookId } },
        select: { rating: true, data: true },
        take: defaultLimit,
        skip: 0,
      });
      expect(mockPrismaService.reviews.aggregate).toHaveBeenCalledWith({
        where: { book: { id: bookId } },
        _avg: { rating: true },
      });
      expect(mockPrismaService.reviews.count).toHaveBeenCalledWith({
        where: { book: { id: bookId } },
      });
      expect(result).toEqual({
        data: { reviews: mockReviews, rating: '4.5' },
        meta: {
          bookId,
          totalReviewCount: mockTotalReviewCount,
          page: defaultPage,
          limit: defaultLimit,
          totalPages: Math.ceil(mockTotalReviewCount / defaultLimit),
        },
      });
    });

    it('should successfully fetch paginated reviews with provided page and limit', async () => {
      const pageNumber = 2;
      const limitNumber = 5;
      const mockReviews = [
        { rating: 3, data: 'Okay book.' },
        { rating: 4, data: 'Enjoyed it.' },
        { rating: 5, data: 'Great!' },
      ];
      const mockAggregateResult = { _avg: { rating: 4 } };
      const mockTotalReviewCount = 22;
      const offset = (pageNumber - 1) * limitNumber;

      mockPrismaService.reviews.findMany.mockResolvedValue(mockReviews);
      mockPrismaService.reviews.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.reviews.count.mockResolvedValue(mockTotalReviewCount);

      const result = await service.findReviewsForBook(
        bookId,
        pageNumber,
        limitNumber,
      );

      expect(mockPrismaService.reviews.findMany).toHaveBeenCalledWith({
        where: { book: { id: bookId } },
        select: { rating: true, data: true },
        take: limitNumber,
        skip: offset,
      });
      expect(mockPrismaService.reviews.aggregate).toHaveBeenCalledWith({
        where: { book: { id: bookId } },
        _avg: { rating: true },
      });
      expect(mockPrismaService.reviews.count).toHaveBeenCalledWith({
        where: { book: { id: bookId } },
      });
      expect(result).toEqual({
        data: { reviews: mockReviews, rating: '4.0' },
        meta: {
          bookId,
          totalReviewCount: mockTotalReviewCount,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(mockTotalReviewCount / limitNumber),
        },
      });
    });

    it('should return empty reviews and average as NaN if no reviews are found, but still return meta', async () => {
      mockPrismaService.reviews.findMany.mockResolvedValueOnce([]);
      mockPrismaService.reviews.aggregate.mockResolvedValueOnce({
        _avg: { rating: null },
      });
      mockPrismaService.reviews.count.mockResolvedValueOnce(0);

      const result = await service.findReviewsForBook(bookId);

      expect(mockPrismaService.reviews.findMany).toHaveBeenCalledWith({
        where: { book: { id: bookId } },
        select: { rating: true, data: true },
        take: defaultLimit,
        skip: 0,
      });
      expect(mockPrismaService.reviews.aggregate).toHaveBeenCalledWith({
        where: { book: { id: bookId } },
        _avg: { rating: true },
      });
      expect(mockPrismaService.reviews.count).toHaveBeenCalledWith({
        where: { book: { id: bookId } },
      });
      expect(result).toEqual({
        data: { reviews: [], rating: '0' },
        meta: {
          bookId,
          totalReviewCount: 0,
          page: defaultPage,
          limit: defaultLimit,
          totalPages: 0,
        },
      });
    });

    it('should return empty reviews for given page and calculate average rating if there are reviews in other pages', async () => {
      mockPrismaService.reviews.findMany.mockResolvedValueOnce([]);
      mockPrismaService.reviews.aggregate.mockResolvedValueOnce({
        _avg: { rating: 3.5 },
      });
      mockPrismaService.reviews.count.mockResolvedValueOnce(2);

      const result = await service.findReviewsForBook(bookId);

      expect(mockPrismaService.reviews.findMany).toHaveBeenCalledWith({
        where: { book: { id: bookId } },
        select: { rating: true, data: true },
        take: defaultLimit,
        skip: 0,
      });
      expect(mockPrismaService.reviews.aggregate).toHaveBeenCalledWith({
        where: { book: { id: bookId } },
        _avg: { rating: true },
      });
      expect(mockPrismaService.reviews.count).toHaveBeenCalledWith({
        where: { book: { id: bookId } },
      });
      expect(result).toEqual({
        data: { reviews: [], rating: '3.5' },
        meta: {
          bookId,
          totalReviewCount: 2,
          page: defaultPage,
          limit: defaultLimit,
          totalPages: 1,
        },
      });
    });

    it('should throw error if there is an error fetching reviews', async () => {
      const error = new Error('Database error');
      mockPrismaService.reviews.findMany.mockRejectedValueOnce(error);

      try {
        await service.findReviewsForBook(bookId);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Reviews could not fetched.');
      }
    });

    it('should throw error if there is an error during average rating calculation', async () => {
      const reviews = [{ rating: 5, data: 'Great book!' }];
      mockPrismaService.reviews.findMany.mockResolvedValueOnce(reviews);
      mockPrismaService.reviews.aggregate.mockRejectedValueOnce(
        new Error('Aggregation error'),
      );

      try {
        await service.findReviewsForBook(bookId);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Reviews could not fetched.');
      }
    });

    it('should throw error if there is an error if count fails', async () => {
      const error = new Error('Database error');
      mockPrismaService.reviews.count.mockRejectedValueOnce(error);

      try {
        await service.findReviewsForBook(bookId);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Reviews could not fetched.');
      }
    });
  });

  describe('delete', () => {
    it('should delete review', async () => {
      mockPrismaService.reviews.delete.mockResolvedValueOnce({});

      const result = await service.delete(1);

      expect(mockPrismaService.reviews.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });

      expect(result).toEqual({ message: 'Review is successfully deleted.' });
    });

    it('should throw an error if the review could not be deleted', async () => {
      mockPrismaService.reviews.delete.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      try {
        await service.delete(1);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Review could not be deleted.');
      }
    });
  });
});
