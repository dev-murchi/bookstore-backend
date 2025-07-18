import { Injectable } from '@nestjs/common';
import { CreateReviewDTO } from 'src/common/dto/create-review.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { ReviewDTO } from 'src/common/dto/review.dto';
import { Prisma } from '@prisma/client';
import { validate } from 'class-validator';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}
  async createReview(
    userId: string,
    createReviewDTO: CreateReviewDTO,
  ): Promise<ReviewDTO> {
    try {
      const { bookId, data, rating } = createReviewDTO;

      // book has to be purchased by the user
      const purchasedBooks = await this.prisma.orderItem.findMany({
        where: {
          bookId: bookId,
          order: { userId: userId, status: 'delivered' },
        },
      });

      if (purchasedBooks.length === 0) {
        throw new CustomAPIError('Please purchase the book to leave a review.');
      }

      const savedReview = await this.prisma.review.create({
        data: {
          user: { connect: { id: userId } },
          book: { connect: { id: bookId } },
          data: data,
          rating: rating,
        },
      });

      return new ReviewDTO(savedReview.id, data, rating, bookId, userId);
    } catch (error) {
      console.error('Review creation failed.Error:', error);
      if (error instanceof CustomAPIError) throw error;

      // database errors
      // unique constraint
      if (error.code === 'P2002')
        throw new CustomAPIError('User can create only one review per book.');
      // no records
      if (error.code === 'P2025')
        throw new CustomAPIError(
          `Book #${createReviewDTO.bookId} or is not found`,
        );

      throw new Error('Review creation failed.');
    }
  }

  private async getReviews(
    condition: Prisma.ReviewWhereInput,
    page: number,
    limit: number,
  ) {
    try {
      // calculate offset for pagination
      const offset = (page - 1) * limit;

      // fetch all reviews for the book
      const reviews = await this.prisma.review.findMany({
        where: condition,
        select: {
          id: true,
          rating: true,
          data: true,
          userId: true,
          bookId: true,
        },
        take: limit,
        skip: offset,
      });

      return reviews;
    } catch (error) {
      console.error('Reviews could not retrieved.Error:', error);
      throw new Error('Reviews could not retrieved.');
    }
  }

  private async fetchAndFormatReviews(
    condition: Prisma.ReviewWhereInput,
    page: number,
    limit: number,
  ): Promise<{
    data: { reviews: ReviewDTO[]; rating: number };
    meta: {
      totalReviewCount: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    try {
      const entityReviews = await this.getReviews(condition, page, limit);

      const reviews = await Promise.all(
        entityReviews.map((review) => this.transformSelectedReview(review)),
      );

      const averageRating = await this.averageRating(condition);

      const totalReviewCount = await this.reviewCount(condition);

      const totalPages = Math.ceil(totalReviewCount / limit);

      return {
        data: {
          reviews,
          rating: averageRating ? Number(averageRating.toFixed(1)) : 0,
        },
        meta: {
          totalReviewCount,
          page,
          limit,
          totalPages,
        },
      };
    } catch (error) {
      console.error(`Could not fetch reviews. Error:`, error);
      throw new Error(`Could not fetch reviews.`);
    }
  }

  async getReviewsOfBook(
    bookId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: { reviews: ReviewDTO[]; rating: number };
    meta: {
      bookId: string;
      totalReviewCount: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const result = await this.fetchAndFormatReviews(
      { bookId: bookId },
      page,
      limit,
    );
    return {
      ...result,
      meta: {
        ...result.meta,
        bookId: bookId,
      },
    };
  }

  async getReviewsForUser(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: { reviews: ReviewDTO[]; rating: number };
    meta: {
      userId: string;
      totalReviewCount: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const result = await this.fetchAndFormatReviews(
      { userId: userId },
      page,
      limit,
    );
    return {
      ...result,
      meta: {
        ...result.meta,
        userId,
      },
    };
  }

  private async transformSelectedReview(review: any): Promise<ReviewDTO> {
    const reviewDTO = new ReviewDTO(
      review.id,
      review.data,
      review.rating,
      review.bookId,
      review.userId,
    );

    const errors = await validate(reviewDTO);

    if (errors.length > 0) {
      console.log('Validation failed for ReviewDTO. Error:', errors);
      throw new Error('Validation failed.');
    }

    return reviewDTO;
  }

  async findReview(id: string): Promise<ReviewDTO | null> {
    try {
      const review = await this.prisma.review.findUnique({
        where: { id },
        select: {
          id: true,
          rating: true,
          data: true,
          userId: true,
          bookId: true,
        },
      });

      if (!review) return null;

      return await this.transformSelectedReview(review);
    } catch (error) {
      console.error('Review could not retrieved.Error:', error);
      throw new Error('Review could not retrieved.');
    }
  }

  private async averageRating(condition: Prisma.ReviewWhereInput) {
    const data = await this.prisma.review.aggregate({
      where: condition,
      _avg: {
        rating: true,
      },
    });

    return data._avg.rating;
  }

  private async reviewCount(condition: Prisma.ReviewWhereInput) {
    const totalReviewCount = await this.prisma.review.count({
      where: condition,
    });

    return totalReviewCount;
  }

  async delete(reviewId: string) {
    try {
      await this.prisma.review.delete({ where: { id: reviewId } });
      return { message: 'Review is successfully deleted.' };
    } catch (error) {
      console.error('Review could not be deleted. Error:', error);
      throw new Error('Review could not be deleted.');
    }
  }
}
