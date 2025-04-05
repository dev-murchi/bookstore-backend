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
      await this.prisma.reviews.create({
        data: {
          user: { connect: { id: userId } },
          book: { connect: { id: createReviewDTO.bookId } },
          data: createReviewDTO.data,
          rating: createReviewDTO.rating,
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
      throw new Error('Review creation failed.');
    }
  }
}
