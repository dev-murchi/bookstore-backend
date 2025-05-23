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
import { ReviewDTO } from '../common/dto/review.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get current user's reviews with rating and pagination",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
    description: 'Number of reviews per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved reviews',
    schema: {
      example: {
        data: {
          data: {
            reviews: [
              {
                id: 1,
                data: 'Excellent read!',
                rating: 5,
                book: 'book-id-uuid',
                owner: 'user-id-uuid',
              },
            ],
            rating: 4.5,
          },
          meta: {
            userId: 'user-id-uuid',
            totalReviewCount: 12,
            page: 1,
            limit: 10,
            totalPages: 2,
          },
        },
      },
    },
  })
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.User])
  async findUserReviews(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
    @Req() request: Request,
  ): Promise<{
    data: {
      data: {
        reviews: ReviewDTO[];
        rating: number;
      };
      meta: {
        userId: string;
        totalReviewCount: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    };
  }> {
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
        'Reviews could not be retrieved due to an unexpected error.',
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get review by ID' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Review ID',
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved review',
    type: ReviewDTO,
  })
  async findReview(
    @Param('id', ParseIntPipe) reviewId: number,
  ): Promise<{ data: ReviewDTO }> {
    try {
      return {
        data: await this.reviewsService.findReview(reviewId),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Review could not be retrieved due to an unexpected error.',
      );
    }
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a review by ID (Admin only)' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Review ID to delete',
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully deleted review',
    schema: {
      example: { message: 'Review deleted successfully.' },
    },
  })
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async deleteReview(
    @Param('id', ParseIntPipe) reviewId: number,
  ): Promise<{ message: string }> {
    try {
      return await this.reviewsService.delete(reviewId);
    } catch (error) {
      throw new InternalServerErrorException(
        'Review could not be deleted due to an unexpected error.',
      );
    }
  }
}
