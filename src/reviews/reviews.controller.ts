import {
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { Request } from 'express';
import { RoleEnum } from 'src/common/enum/role.enum';
import { Roles } from 'src/common/decorator/role/role.decorator';
import { ReviewDTO } from 'src/common/dto/review.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RoleGuard } from 'src/auth/guards/role.guard';

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
    description: 'Reviews retrieved',
    type: ReviewDTO,
    schema: {
      example: {
        data: {
          data: {
            reviews: [
              {
                id: 'review-uuid-1',
                data: 'Excellent read!',
                rating: 5,
                book: 'book-id-uuid',
                owner: 'abcdef01-2345-6789-abcd-ef0123456789',
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
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles([RoleEnum.User])
  async findUserReviews(
    @Query('page', ParseIntPipe) page: number,
    @Query('limit', ParseIntPipe) limit: number,
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
    example: 'review-uuid-1',
  })
  @ApiResponse({
    status: 200,
    description: 'Review retrieved',

    schema: {
      properties: {
        data: {
          type: 'object',
          $ref: getSchemaPath(ReviewDTO),
        },
      },
    },
  })
  async findReview(
    @Param('id', ParseUUIDPipe) reviewId: string,
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
    example: 'review-uuid-1',
  })
  @ApiResponse({
    status: 200,
    description: 'Review successfully deleted',
    schema: {
      example: { message: 'Review deleted successfully.' },
    },
  })
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles([RoleEnum.Admin])
  async deleteReview(
    @Param('id', ParseUUIDPipe) reviewId: string,
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
