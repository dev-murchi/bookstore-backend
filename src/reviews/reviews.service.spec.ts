import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDTO } from '../common/dto/create-review.dto';
import { Prisma } from '@prisma/client';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { ReviewDTO } from '../common/dto/review.dto';
import * as classValidator from 'class-validator';

const mockReviewId = '12345678-abcd-9012-efab-3456789abcde'; // just example
const mockReviewId2 = '12345678-abcd-9013-efab-3456789abcde'; // just example
const mockReviewId3 = '12345678-abcd-9014-efab-3456789abcde'; // just example
const userId = '5610eb78-6602-4408-88f6-c2889cd136b7'; // just example
const userId2 = 'f339ecf9-35c3-4e34-8374-3d8cae0de6f1'; // just example
const userId3 = '0b789cb1-9089-4b16-9c93-7b00bf118f3a'; // just example
const bookId = 'ba22e8c2-8d5f-4ae2-835d-12f488667aed'; // just example
const bookId2 = '19eb87d8-0a4f-4c2c-a653-e41c58918add'; // just example

const mockPrismaService = {
  reviews: {
    create: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
  },
  order_items: { findMany: jest.fn() },
};
describe('ReviewsService', () => {
  let service: ReviewsService;
  let validatorSpy: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    validatorSpy = jest.spyOn(classValidator, 'validate');
    validatorSpy.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createReviewDTO: CreateReviewDTO = {
      bookId: bookId2,
      data: 'This is a great book!',
      rating: 5,
    };

    it('should successfully create a review', async () => {
      mockPrismaService.order_items.findMany.mockResolvedValueOnce([
        { bookid: bookId },
      ]);
      mockPrismaService.reviews.create.mockResolvedValueOnce({
        id: mockReviewId,
      });

      const result = await service.createReview(userId, createReviewDTO);

      expect(mockPrismaService.reviews.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { id: userId } },
          book: { connect: { id: createReviewDTO.bookId } },
          data: createReviewDTO.data,
          rating: createReviewDTO.rating,
        },
      });
      expect(result).toEqual({
        id: mockReviewId,
        book: bookId2,
        data: 'This is a great book!',
        owner: userId,
        rating: 5,
      });
    });

    it('should throw an error if the user has already reviewed the book', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`userId`,`bookId`)',
        {
          code: 'P2002',
        } as any,
      );
      mockPrismaService.order_items.findMany.mockResolvedValueOnce([
        { bookid: bookId },
      ]);
      mockPrismaService.reviews.create.mockRejectedValueOnce(prismaError);

      try {
        await service.createReview(userId, createReviewDTO);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('User can create only one review per book.');
        expect(mockPrismaService.reviews.create).toHaveBeenCalledWith({
          data: {
            user: { connect: { id: userId } },
            book: { connect: { id: createReviewDTO.bookId } },
            data: createReviewDTO.data,
            rating: createReviewDTO.rating,
          },
        });
      }
    });

    it('should throw an error if the book is not purchased', async () => {
      mockPrismaService.order_items.findMany.mockResolvedValueOnce([]);

      try {
        await service.createReview(userId, createReviewDTO);
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

      mockPrismaService.order_items.findMany.mockResolvedValueOnce([
        { bookid: bookId },
      ]);
      mockPrismaService.reviews.create.mockRejectedValueOnce(prismaError);

      try {
        await service.createReview(userId, createReviewDTO);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe(
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
      }
    });

    it('should throw generic error for unknown error types', async () => {
      const error = new Error('Unknown database error');
      mockPrismaService.order_items.findMany.mockResolvedValueOnce([
        { bookid: bookId },
      ]);
      mockPrismaService.reviews.create.mockRejectedValueOnce(error);

      try {
        await service.createReview(userId, createReviewDTO);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Review creation failed.');
      }
    });
  });

  describe('getReviewsOfBook', () => {
    const defaultPage = 1;
    const defaultLimit = 10;

    it('should successfully fetch paginated reviews with default parameters and calculate metadata', async () => {
      const mockReviews = [
        {
          id: mockReviewId,
          rating: 5,
          bookid: bookId,
          data: 'Excellent book!',
          userid: userId,
        },
        {
          id: mockReviewId2,
          rating: 4,
          bookid: bookId,
          data: 'Good read.',
          userid: userId2,
        },
      ];
      const mockAggregateResult = { _avg: { rating: 4.5 } };
      const mockTotalReviewCount = 25;

      mockPrismaService.reviews.findMany.mockResolvedValue(mockReviews);
      mockPrismaService.reviews.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.reviews.count.mockResolvedValue(mockTotalReviewCount);

      const result = await service.getReviewsOfBook(bookId);

      expect(mockPrismaService.reviews.findMany).toHaveBeenCalledWith({
        where: { bookid: bookId },
        select: {
          id: true,
          rating: true,
          data: true,
          userid: true,
          bookid: true,
        },
        take: defaultLimit,
        skip: 0,
      });
      expect(mockPrismaService.reviews.aggregate).toHaveBeenCalledWith({
        where: { bookid: bookId },
        _avg: { rating: true },
      });
      expect(mockPrismaService.reviews.count).toHaveBeenCalledWith({
        where: { bookid: bookId },
      });
      expect(result).toEqual({
        data: {
          reviews: [
            {
              id: mockReviewId,
              data: 'Excellent book!',
              rating: 5,
              book: bookId,
              owner: userId,
            },
            {
              id: mockReviewId2,
              data: 'Good read.',
              rating: 4,
              book: bookId,
              owner: userId2,
            },
          ],
          rating: 4.5,
        },
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
        {
          id: mockReviewId,
          userid: userId,
          bookid: bookId,
          rating: 3,
          data: 'Okay book.',
        },
        {
          id: mockReviewId2,
          userid: userId2,
          bookid: bookId,
          rating: 4,
          data: 'Enjoyed it.',
        },
        {
          id: mockReviewId3,
          userid: userId3,
          bookid: bookId,
          rating: 5,
          data: 'Great!',
        },
      ];
      const mockAggregateResult = { _avg: { rating: 4 } };
      const mockTotalReviewCount = 22;
      const offset = (pageNumber - 1) * limitNumber;

      mockPrismaService.reviews.findMany.mockResolvedValue(mockReviews);
      mockPrismaService.reviews.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.reviews.count.mockResolvedValue(mockTotalReviewCount);

      const result = await service.getReviewsOfBook(
        bookId,
        pageNumber,
        limitNumber,
      );

      expect(mockPrismaService.reviews.findMany).toHaveBeenCalledWith({
        where: { bookid: bookId },
        select: {
          id: true,
          rating: true,
          data: true,
          userid: true,
          bookid: true,
        },
        take: limitNumber,
        skip: offset,
      });
      expect(mockPrismaService.reviews.aggregate).toHaveBeenCalledWith({
        where: { bookid: bookId },
        _avg: { rating: true },
      });
      expect(mockPrismaService.reviews.count).toHaveBeenCalledWith({
        where: { bookid: bookId },
      });
      expect(result).toEqual({
        data: {
          reviews: [
            {
              id: mockReviewId,
              data: 'Okay book.',
              rating: 3,
              book: bookId,
              owner: userId,
            },
            {
              id: mockReviewId2,
              data: 'Enjoyed it.',
              rating: 4,
              book: bookId,
              owner: userId2,
            },
            {
              id: mockReviewId3,
              data: 'Great!',
              rating: 5,
              book: bookId,
              owner: userId3,
            },
          ],
          rating: 4,
        },
        meta: {
          bookId,
          totalReviewCount: mockTotalReviewCount,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(mockTotalReviewCount / limitNumber),
        },
      });
    });

    it('should return empty reviews and average as 0 if no reviews are found, but still return meta', async () => {
      mockPrismaService.reviews.findMany.mockResolvedValueOnce([]);
      mockPrismaService.reviews.aggregate.mockResolvedValueOnce({
        _avg: { rating: null },
      });
      mockPrismaService.reviews.count.mockResolvedValueOnce(0);

      const result = await service.getReviewsOfBook(bookId);

      expect(mockPrismaService.reviews.findMany).toHaveBeenCalledWith({
        where: { bookid: bookId },
        select: {
          id: true,
          rating: true,
          data: true,
          userid: true,
          bookid: true,
        },
        take: defaultLimit,
        skip: 0,
      });
      expect(mockPrismaService.reviews.aggregate).toHaveBeenCalledWith({
        where: { bookid: bookId },
        _avg: { rating: true },
      });
      expect(mockPrismaService.reviews.count).toHaveBeenCalledWith({
        where: { bookid: bookId },
      });
      expect(result).toEqual({
        data: { reviews: [], rating: 0 },
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

      const result = await service.getReviewsOfBook(bookId);

      expect(mockPrismaService.reviews.findMany).toHaveBeenCalledWith({
        where: { bookid: bookId },
        select: {
          id: true,
          rating: true,
          data: true,
          userid: true,
          bookid: true,
        },
        take: defaultLimit,
        skip: 0,
      });
      expect(mockPrismaService.reviews.aggregate).toHaveBeenCalledWith({
        where: { bookid: bookId },
        _avg: { rating: true },
      });
      expect(mockPrismaService.reviews.count).toHaveBeenCalledWith({
        where: { bookid: bookId },
      });
      expect(result).toEqual({
        data: { reviews: [], rating: 3.5 },
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
        await service.getReviewsOfBook(bookId);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Could not fetch reviews.');
      }
    });

    it('should throw error if there is an error during average rating calculation', async () => {
      const reviews = [
        {
          id: mockReviewId,
          userid: userId,
          rating: 5,
          data: 'Great book!',
          bookid: bookId,
        },
      ];
      mockPrismaService.reviews.findMany.mockResolvedValueOnce(reviews);
      mockPrismaService.reviews.aggregate.mockRejectedValueOnce(
        new Error('Aggregation error'),
      );

      try {
        await service.getReviewsOfBook(bookId);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Could not fetch reviews.');
      }
    });

    it('should throw error if there is an error if count fails', async () => {
      const error = new Error('Database error');
      mockPrismaService.reviews.count.mockRejectedValueOnce(error);

      try {
        await service.getReviewsOfBook(bookId);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Could not fetch reviews.');
      }
    });
  });

  describe('delete', () => {
    it('should delete review', async () => {
      mockPrismaService.reviews.delete.mockResolvedValueOnce({});

      const result = await service.delete(mockReviewId);

      expect(mockPrismaService.reviews.delete).toHaveBeenCalledWith({
        where: { id: mockReviewId },
      });

      expect(result).toEqual({ message: 'Review is successfully deleted.' });
    });

    it('should throw an error if the review could not be deleted', async () => {
      mockPrismaService.reviews.delete.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      try {
        await service.delete(mockReviewId);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Review could not be deleted.');
      }
    });
  });

  describe('getReviewsForUser', () => {
    const defaultPage = 1;
    const defaultLimit = 10;

    it('should retrieve paginated reviews with default parameters and calculate metadata', async () => {
      const mockReviews = [
        {
          id: mockReviewId,
          rating: 5,
          bookid: bookId,
          data: 'Excellent book!',
          userid: userId,
        },
        {
          id: mockReviewId2,
          rating: 4,
          bookid: bookId2,
          data: 'Good read.',
          userid: userId,
        },
      ];
      const mockAggregateResult = { _avg: { rating: 4.5 } };
      const mockTotalReviewCount = 25;

      mockPrismaService.reviews.findMany.mockResolvedValue(mockReviews);
      mockPrismaService.reviews.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.reviews.count.mockResolvedValue(mockTotalReviewCount);

      const result = await service.getReviewsForUser(userId);

      expect(mockPrismaService.reviews.findMany).toHaveBeenCalledWith({
        where: { userid: userId },
        select: {
          id: true,
          rating: true,
          data: true,
          userid: true,
          bookid: true,
        },
        take: defaultLimit,
        skip: 0,
      });
      expect(mockPrismaService.reviews.aggregate).toHaveBeenCalledWith({
        where: { userid: userId },
        _avg: { rating: true },
      });
      expect(mockPrismaService.reviews.count).toHaveBeenCalledWith({
        where: { userid: userId },
      });
      expect(result).toEqual({
        data: {
          reviews: [
            {
              id: mockReviewId,
              data: 'Excellent book!',
              rating: 5,
              book: bookId,
              owner: userId,
            },
            {
              id: mockReviewId2,
              data: 'Good read.',
              rating: 4,
              book: bookId2,
              owner: userId,
            },
          ],
          rating: 4.5,
        },
        meta: {
          userId,
          totalReviewCount: mockTotalReviewCount,
          page: defaultPage,
          limit: defaultLimit,
          totalPages: Math.ceil(mockTotalReviewCount / defaultLimit),
        },
      });
    });
  });

  describe('findReview', () => {
    it('should throw an error when db error occurs', async () => {
      mockPrismaService.reviews.findUnique.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(service.findReview(mockReviewId)).rejects.toThrow(
        'Review could not retrieved.',
      );
    });

    it('should return null if there is review with given id', async () => {
      mockPrismaService.reviews.findUnique.mockResolvedValueOnce(null);
      const result = await service.findReview(mockReviewId);
      expect(result).toBeNull();
    });

    it('should return the review if it is exist', async () => {
      const review = {
        id: mockReviewId,
        userid: userId,
        rating: 5,
        data: 'Great book!',
        bookid: bookId,
      };
      mockPrismaService.reviews.findUnique.mockResolvedValueOnce(review);
      const result = await service.findReview(mockReviewId);
      expect(result).toEqual(
        new ReviewDTO(mockReviewId, 'Great book!', 5, bookId, userId),
      );
    });
  });

  describe('transformSelectedReview', () => {
    it('should successfully transform to the ReviewDTO', async () => {
      const review = {
        id: mockReviewId,
        userid: userId,
        rating: 5,
        data: 'Great book!',
        bookid: bookId,
      };

      const result = await service['transformSelectedReview'](review);
      expect(result).toEqual(
        new ReviewDTO(mockReviewId, 'Great book!', 5, bookId, userId),
      );
    });
    it('should throw an eror when validation fails', async () => {
      const review = {
        id: mockReviewId,
        userid: userId,
        rating: 5,
        data: 'Great book!',
        bookid: bookId,
      };

      validatorSpy.mockResolvedValueOnce([
        {
          property: 'bookid',
          constraints: { isUuid: 'bookid must be a UUID' },
        },
      ] as any);

      await expect(service['transformSelectedReview'](review)).rejects.toThrow(
        'Validation failed.',
      );

      validatorSpy.mockRestore();
    });
  });
});
