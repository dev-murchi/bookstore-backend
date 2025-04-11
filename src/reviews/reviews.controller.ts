import {
  Body,
  Controller,
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
    return await this.reviewsService.create(
      request.user['id'],
      createReviewDTO,
    );
  }

  @Get()
  async findAll(@Query('book', ParseIntPipe) bookId: number) {
    return await this.reviewsService.findReviewsForBook(bookId);
  }
}
