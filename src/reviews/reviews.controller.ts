import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateReviewDTO } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';
import { Request } from 'express';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { RoleEnum } from '../common/role.enum';
import { Roles } from '../common/decorator/role/role.decorator';
import { CustomAPIError } from '../common/errors/custom-api.error';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}
  @Post()
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.User])
  async create(
    @Body() createReviewDTO: CreateReviewDTO,
    @Req() request: Request,
  ) {
    try {
      return await this.reviewsService.create(
        request.user['id'],
        createReviewDTO,
      );
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException(
        'Review creation failed due to an unexpected error.',
      );
    }
  }

  @Get()
  async findAll(
    @Query('book', ParseUUIDPipe) bookId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    try {
      return await this.reviewsService.findReviewsForBook(bookId, page, limit);
    } catch (error) {
      throw new InternalServerErrorException(
        'Book(s) could not fetched due to an unexpected error.',
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
