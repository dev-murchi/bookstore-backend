import { Injectable } from '@nestjs/common';
import { CreateReviewDTO } from './dto/create-review.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { ReviewDTO } from './dto/review.dto';
import { Prisma } from '@prisma/client';

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
      const purchasedBooks = await this.prisma.order_items.findMany({
        where: {
          bookid: bookId,
          order: { userid: userId, status: 'delivered' },
        },
      });

      if (purchasedBooks.length === 0) {
        throw new CustomAPIError('Please purchase the book to leave a review.');
      }

      const savedReview = await this.prisma.reviews.create({
        data: {
          user: { connect: { userid: userId } },
          book: { connect: { bookid: bookId } },
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
    condition: Prisma.reviewsWhereInput,
    page: number,
    limit: number,
  ) {
    try {
      // calculate offset for pagination
      const offset = (page - 1) * limit;

      // fetch all reviews for the book
      const reviews = await this.prisma.reviews.findMany({
        where: condition,
        select: {
          id: true,
          rating: true,
          data: true,
          userid: true,
          bookid: true,
        },
        take: limit,
        skip: offset,
      });

      return reviews;
    } catch (error) {
      console.error('Reviews could not fetched.Error:', error);
      throw new Error('Reviews could not fetched.');
    }
  }

  private async fetchAndFormatReviews(
    condition: Prisma.reviewsWhereInput,
    page: number = 1,
    limit: number = 10,
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

      const reviews = entityReviews.map((review) =>
        this.transformSelectedReview(review),
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
      { bookid: bookId },
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
      { userid: userId },
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

  private transformSelectedReview(review: any): ReviewDTO {
    return new ReviewDTO(
      review.id,
      review.data,
      review.rating,
      review.bookid,
      review.userid,
    );
  }

  async findReview(id: number): Promise<ReviewDTO | null> {
    try {
      const review = await this.prisma.reviews.findUnique({
        where: { id },
        select: {
          id: true,
          rating: true,
          data: true,
          userid: true,
          bookid: true,
        },
      });

      if (!review) return null;

      return this.transformSelectedReview(review);
    } catch (error) {
      console.error('Review could not fetched.Error:', error);
      throw new Error('Review could not fetched.');
    }
  }

  private async averageRating(condition: Prisma.reviewsWhereInput) {
    const data = await this.prisma.reviews.aggregate({
      where: condition,
      _avg: {
        rating: true,
      },
    });

    return data._avg.rating;
  }

  private async reviewCount(condition: Prisma.reviewsWhereInput) {
    const totalReviewCount = await this.prisma.reviews.count({
      where: condition,
    });

    return totalReviewCount;
  }

  async delete(reviewId: number) {
    try {
      await this.prisma.reviews.delete({ where: { id: reviewId } });
      return { message: 'Review is successfully deleted.' };
    } catch (error) {
      console.error('Review could not be deleted. Error:', error);
      throw new Error('Review could not be deleted.');
    }
  }
}
