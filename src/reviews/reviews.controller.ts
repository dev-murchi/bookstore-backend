import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth/auth.guard';
import { CreateReviewDTO } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';
import { Request } from 'express';

@Controller('reviews')
@UseGuards(AuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}
  @Post()
  async create(
    @Body() createReviewDTO: CreateReviewDTO,
    @Req() request: Request,
  ) {
    return await this.reviewsService.create(
      request.user['id'],
      createReviewDTO,
    );
  }
}
