import { Injectable } from '@nestjs/common';
import { CreateReviewDTO } from './dto/create-review.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { Review } from '../common/types';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}
  async createReview(
    userId: string,
    createReviewDTO: CreateReviewDTO,
  ): Promise<Review> {
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

      return {
        id: savedReview.id,
        data: data,
        rating: rating,
        book: bookId,
        owner: userId,
      };
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

  async getReviews(
    bookId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: { reviews: Review[]; rating: number };
    meta: {
      bookId: string;
      totalReviewCount: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    try {
      // calculate offset for pagination
      const offset = (page - 1) * limit;

      // fetch all reviews for the book
      const bookReviews = await this.prisma.reviews.findMany({
        where: { book: { bookid: bookId } },
        select: { id: true, rating: true, data: true, userid: true },
        take: limit,
        skip: offset,
      });

      const reviews = bookReviews.map((review) => ({
        id: review.id,
        data: review.data,
        rating: review.rating,
        book: bookId,
        owner: review.userid,
      }));

      // calculate average rating
      const averageRating = (
        await this.prisma.reviews.aggregate({
          where: {
            book: { bookid: bookId },
          },
          _avg: {
            rating: true,
          },
        })
      )._avg.rating;

      // fetch review count
      const totalReviewCount = await this.prisma.reviews.count({
        where: { book: { bookid: bookId } },
      });

      // calculate total pages
      const totalPages = Math.ceil(totalReviewCount / limit);

      return {
        data: {
          reviews,
          rating: averageRating ? Number(averageRating.toFixed(1)) : 0,
        },
        meta: {
          bookId,
          totalReviewCount,
          page,
          limit,
          totalPages,
        },
      };
    } catch (error) {
      console.error('Reviews could not fetched.Error:', error);
      throw new Error('Reviews could not fetched.');
    }
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
