import { Injectable } from '@nestjs/common';
import { CreateReviewDTO } from './dto/create-review.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(userId: number, createReviewDTO: CreateReviewDTO) {
    // save the user reviews about the book to the database.
    try {
      const { bookId, data, rating } = createReviewDTO;

      // book has to be purchased by the user
      const purchasedBook = await this.prisma.books.findUnique({
        where: {
          id: bookId,
          order_items: {
            some: {
              order: {
                userid: userId,
              },
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!purchasedBook) {
        throw new Error('purchase required');
      }

      await this.prisma.reviews.create({
        data: {
          user: { connect: { id: userId } },
          book: { connect: { id: bookId } },
          data: data,
          rating: rating,
        },
      });

      return { message: 'Review created.' };
    } catch (error) {
      // database errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // unique constraint
        if (error.code === 'P2002')
          throw new Error('User can create only one review per book.');
        // no records
        if (error.code === 'P2025')
          throw new Error(`Book #${createReviewDTO.bookId} or is not found`);
      }

      if (error.message === 'purchase required') {
        throw new Error('Please purchase the book to leave a review.');
      }
      throw new Error('Review creation failed.');
    }
  }

  async findReviewsForBook(
    bookId: number,
    page: number = 1,
    limit: number = 10,
  ) {
    try {
      // calculate offset for pagination
      const offset = (page - 1) * limit;

      // fetch all reviews for the book
      const reviews = await this.prisma.reviews.findMany({
        where: { book: { id: bookId } },
        select: { rating: true, data: true },
        take: limit,
        skip: offset,
      });

      // calculate average rating
      const averageRating = (
        await this.prisma.reviews.aggregate({
          where: {
            book: { id: bookId },
          },
          _avg: {
            rating: true,
          },
        })
      )._avg.rating;

      // fetch review count
      const totalReviewCount = await this.prisma.reviews.count({
        where: { book: { id: bookId } },
      });

      // calculate total pages
      const totalPages = Math.ceil(totalReviewCount / limit);

      return {
        data: {
          reviews,
          rating: averageRating ? averageRating.toFixed(1) : '0',
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
      console.error(error);
      throw new Error('Reviews could not fetched.');
    }
  }

  async delete(reviewId: number) {
    try {
      await this.prisma.reviews.delete({ where: { id: reviewId } });
      return { message: 'Review is successfully deleted.' };
    } catch (error) {
      throw new Error('Review could not be deleted.');
    }
  }
}
