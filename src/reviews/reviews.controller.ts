import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
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
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  async findAll(
    @Query('book', ParseIntPipe) bookId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
  ) {
    return await this.reviewsService.findReviewsForBook(bookId, page, limit);
  }
}
