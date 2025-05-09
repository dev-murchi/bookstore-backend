import {
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { Request } from 'express';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { RoleEnum } from '../common/role.enum';
import { Roles } from '../common/decorator/role/role.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.User])
  async findUserReviews(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Req() request: Request,
  ) {
    try {
      return {
        data: await this.reviewsService.getReviewsForUser(
          request.user['id'],
          page,
          limit,
        ),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Reviews could not fetched due to an unexpected error.',
      );
    }
  }

  @Get(':id')
  async findReview(@Param('id', ParseIntPipe) reviewId: number) {
    try {
      return {
        data: await this.reviewsService.findReview(reviewId),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Review could not fetched due to an unexpected error.',
      );
    }
  }

  @Delete(':id')
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async deleteReview(@Param('id', ParseIntPipe) reviewId: number) {
    try {
      return await this.reviewsService.delete(reviewId);
    } catch (error) {
      throw new InternalServerErrorException(
        'Book could not deleted due to an unexpected error.',
      );
    }
  }
}
