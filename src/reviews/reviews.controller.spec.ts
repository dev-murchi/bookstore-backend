import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RoleGuard } from 'src/auth/guards/role.guard';
import { InternalServerErrorException } from '@nestjs/common';
import { RoleEnum } from 'src/common/enum/role.enum';

const mockReviewsService = {
  getReviewsForUser: jest.fn(),
  findReview: jest.fn(),
  delete: jest.fn(),
};

describe('ReviewsController', () => {
  let controller: ReviewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: mockReviewsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ handleRequest: jest.fn() })
      .overrideGuard(RoleGuard)
      .useValue({ handleRequest: jest.fn() })
      .compile();

    controller = module.get<ReviewsController>(ReviewsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findUserReviews', () => {
    const request = {
      user: { id: 'user-uuid-1', role: RoleEnum.User },
    } as any;

    const reviewsData = {
      reviews: [
        {
          id: 'review-uuid-1',
          data: 'Excellent read!',
          rating: 5,
          book: 'book-id-uuid',
          owner: 'abcdef01-2345-6789-abcd-ef0123456789',
        },
      ],
      rating: 4.5,
    };
    const meta = {
      userId: 'user-uuid-1',
      totalReviewCount: 12,
      page: 1,
      limit: 10,
      totalPages: 2,
    };

    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockReviewsService.getReviewsForUser.mockRejectedValue(
        new Error('Unknown Error'),
      );

      try {
        await controller.findUserReviews(1, 10, request);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Reviews could not be retrieved due to an unexpected error.',
        );
      }
    });

    it('should return user reviews with rating and meta', async () => {
      mockReviewsService.getReviewsForUser.mockResolvedValue({
        data: reviewsData,
        meta,
      });
      const result = await controller.findUserReviews(1, 10, request);
      expect(result.data.data).toEqual(reviewsData);
      expect(result.data.meta).toEqual(meta);
      expect(mockReviewsService.getReviewsForUser).toHaveBeenCalledWith(
        'user-uuid-1',
        1,
        10,
      );
    });
  });

  describe('findReview', () => {
    const reviewId = 'review-uuid-1';
    const review = {
      id: reviewId,
      data: 'Excellent read!',
      rating: 5,
      book: 'book-id-uuid',
      owner: 'abcdef01-2345-6789-abcd-ef0123456789',
    };

    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockReviewsService.findReview.mockRejectedValue(
        new Error('Unknown Error'),
      );

      try {
        await controller.findReview(reviewId);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Review could not be retrieved due to an unexpected error.',
        );
      }
    });

    it('should return review by id', async () => {
      mockReviewsService.findReview.mockResolvedValue(review);
      const result = await controller.findReview(reviewId);
      expect(result.data).toEqual(review);
      expect(mockReviewsService.findReview).toHaveBeenCalledWith(reviewId);
    });
  });

  describe('deleteReview', () => {
    const reviewId = 'review-uuid-1';

    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockReviewsService.delete.mockRejectedValue(new Error('Unknown Error'));

      try {
        await controller.deleteReview(reviewId);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Review could not be deleted due to an unexpected error.',
        );
      }
    });

    it('should delete review by id', async () => {
      mockReviewsService.delete.mockResolvedValue({
        message: 'Review deleted successfully.',
      });
      const result = await controller.deleteReview(reviewId);
      expect(result).toEqual({ message: 'Review deleted successfully.' });
      expect(mockReviewsService.delete).toHaveBeenCalledWith(reviewId);
    });
  });
});
