import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  BadRequestException,
  Param,
  ParseIntPipe,
  Patch,
  Get,
  Query,
  InternalServerErrorException,
  UnauthorizedException,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDTO } from 'src/common/dto/create-book.dto';
import { UpdateBookDTO } from 'src/common/dto/update-book.dto';
import { Request } from 'express';
import { Roles } from 'src/common/decorator/role/role.decorator';
import { RoleEnum } from 'src/common/enum/role.enum';
import { UserService } from 'src/user/user.service';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { BookDTO } from 'src/common/dto/book.dto';
import { BookReviewDTO } from 'src/common/dto/book-review.dto';
import { ReviewsService } from 'src/reviews/reviews.service';
import { ReviewDTO } from 'src/common/dto/review.dto';
import { CreateReviewDTO } from 'src/common/dto/create-review.dto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RoleGuard } from 'src/auth/guards/role.guard';
import { BookFilterDTO } from 'src/common/dto/book-filter.dto';

@ApiTags('Books')
@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private userService: UserService,
    private reviewsService: ReviewsService,
  ) {}

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles([RoleEnum.Admin, RoleEnum.Author])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new book (Author and Admin only)' })
  @ApiBody({ type: CreateBookDTO })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Book successfully created',
    schema: {
      properties: {
        data: {
          type: 'object',
          $ref: getSchemaPath(BookDTO),
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation or business logic error' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async create(
    @Req() request: Request,
    @Body() createBookDto: CreateBookDTO,
  ): Promise<{ data: BookDTO }> {
    try {
      const { authorId } = await this.validateAuthorOrThrow(
        {
          id: request.user['id'],
          email: request.user['email'],
          role: request.user['role'],
        },
        createBookDto.author,
      );
      const createdBook = await this.booksService.create(
        authorId,
        createBookDto,
      );
      return { data: createdBook };
    } catch (error) {
      console.error('Unexpected error during book creation:', error);

      if (error instanceof BadRequestException) throw error;
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException(
        'Failed to create book due to an unexpected error.',
      );
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve all books' })
  @ApiOkResponse({
    description: 'Books retrieved',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: {
            $ref: getSchemaPath(BookDTO),
          },
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({ description: 'Failed to retrieve books' })
  async findAll(): Promise<{ data: BookDTO[] }> {
    try {
      return { data: await this.booksService.findAll() };
    } catch (error) {
      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException(
        'Failed to retrieve the books due to an unexpected error.',
      );
    }
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search books by keyword' })
  @ApiQuery({ name: 'search', required: true, type: String })
  @ApiOkResponse({
    description: 'Books matching the search query',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: {
            $ref: getSchemaPath(BookDTO),
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Search query too short' })
  async search(@Query('search') query: string): Promise<{ data: BookDTO[] }> {
    try {
      if (!query) return { data: [] };
      if (query.length < 3)
        throw new BadRequestException(
          'The query must contain at least three characters.',
        );
      return { data: await this.booksService.search(query) };
    } catch (error) {
      console.error(
        'Failed to search the book due to an unexpected error.',
        error,
      );
      if (error instanceof BadRequestException) throw error;
      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException(
        'Failed to search the book due to an unexpected error.',
      );
    }
  }

  @Get('filter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Filter books by price, rating, stock, and sort' })
  @ApiOkResponse({
    description: 'Books matching the filter query',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: {
            $ref: getSchemaPath(BookDTO),
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation error or custom filtering logic failure.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server error while filtering books.',
  })
  async filter(@Query() query: BookFilterDTO): Promise<{ data: BookDTO[] }> {
    try {
      const { minPrice, maxPrice, rating, sort, stock } = query;

      const filteredBooks = await this.booksService.filter({
        minPrice,
        maxPrice,
        rating,
        stock,
        orderBy: sort,
      });

      return { data: filteredBooks };
    } catch (error) {
      console.error(
        'Failed to filter the books due to an unexpected error.',
        error,
      );

      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException(
        'Failed to filter the books due to an unexpected error.',
      );
    }
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get book by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({
    description: 'Book found',
    schema: {
      properties: {
        data: {
          type: 'object',
          $ref: getSchemaPath(BookDTO),
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({ description: 'Book retrieval failed' })
  async findOne(@Param('id') id: string): Promise<{ data: BookDTO }> {
    try {
      const book = await this.booksService.findOne(id);
      return { data: book };
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException(
        'Failed to retrieve the book due to an unexpected error',
      );
    }
  }

  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles([RoleEnum.Admin, RoleEnum.Author])
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update book by ID (Author and Admin only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateBookDTO })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Book updated',
    schema: {
      properties: {
        data: {
          type: 'object',
          $ref: getSchemaPath(BookDTO),
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Bad request' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized to update' })
  @ApiInternalServerErrorResponse({ description: 'Failed to update book' })
  async update(
    @Req() request: Request,
    @Param('id', ParseUUIDPipe) bookId: string,
    @Body() updateBookDto: UpdateBookDTO,
  ): Promise<{ data: BookDTO }> {
    try {
      const { authorId } = await this.validateAuthorOrThrow(
        {
          id: request.user['id'],
          email: request.user['email'],
          role: request.user['role'],
        },
        updateBookDto.author,
      );

      const updatedBook = await this.booksService.update(
        bookId,
        updateBookDto,
        authorId,
      );

      return {
        data: updatedBook,
      };
    } catch (error) {
      console.error('Failed to update book. Error:', error);
      if (error instanceof BadRequestException) throw error;
      if (error instanceof UnauthorizedException) throw error;

      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException(
        'Failed to update book due to an unexpected error.',
      );
    }
  }

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles([RoleEnum.User])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a review for a book (Authenticated User only)',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: BookReviewDTO })
  @ApiBearerAuth()
  @ApiOkResponse({
    description: 'Review submitted',
    schema: {
      properties: {
        data: {
          type: 'object',
          $ref: getSchemaPath(ReviewDTO),
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid review data' })
  @ApiInternalServerErrorResponse({ description: 'Failed to submit review' })
  async createBookReview(
    @Param('id', ParseUUIDPipe) bookId: string,
    @Body() bookReviewDto: BookReviewDTO,
    @Req() request: Request,
  ): Promise<{ data: ReviewDTO }> {
    try {
      return {
        data: await this.reviewsService.createReview(
          request.user['id'],
          new CreateReviewDTO(bookId, bookReviewDto.data, bookReviewDto.rating),
        ),
      };
    } catch (error) {
      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException(
        `Review creation for the Book #${bookId} failed due to an unexpected error.`,
      );
    }
  }

  @Get(':id/reviews')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get reviews for a specific book' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiOkResponse({
    description: 'Paginated reviews with rating metadata',
    schema: {
      properties: {
        data: {
          properties: {
            data: {
              properties: {
                reviews: {
                  type: 'array',
                  items: {
                    $ref: getSchemaPath(ReviewDTO),
                  },
                },
                rating: { type: 'number', example: 4.5 },
              },
            },
            meta: {
              properties: {
                bookId: {
                  type: 'string',
                  example: 'a1b2c3d4-e5f6-4890-ab12-cd34ef56ab78',
                },
                totalReviewCount: { type: 'number', example: 11 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 10 },
                totalPages: { type: 'number', example: 1 },
              },
            },
          },
        },
      },
    },
  })
  async findBookReviews(
    @Param('id', ParseUUIDPipe) bookId: string,
    @Query('page', ParseIntPipe) page: number,
    @Query('limit', ParseIntPipe) limit: number,
  ): Promise<{
    data: {
      data: {
        reviews: ReviewDTO[];
        rating: number;
      };
      meta: {
        bookId: string;
        totalReviewCount: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    };
  }> {
    try {
      return {
        data: await this.reviewsService.getReviewsOfBook(bookId, page, limit),
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Reviews could not fetched due to an unexpected error.',
      );
    }
  }

  private async validateAuthorOrThrow(
    requestUser: { id: string; email: string; role: RoleEnum },
    authorEmail: string,
  ): Promise<{ authorId: string }> {
    if (![RoleEnum.Admin, RoleEnum.Author].includes(requestUser.role)) {
      throw new UnauthorizedException(
        'You are not authorized to perform this action.',
      );
    }

    if (requestUser.role === RoleEnum.Author) {
      if (requestUser.email !== authorEmail) {
        throw new UnauthorizedException(
          'You are not authorized to perform this action.',
        );
      }
      return { authorId: requestUser.id };
    }

    const targetAuthor = await this.userService.findByEmail(authorEmail);
    if (!targetAuthor) {
      throw new BadRequestException(
        'Please ensure the author exists before proceeding.',
      );
    }

    if (targetAuthor.role !== RoleEnum.Author) {
      throw new BadRequestException(
        'Books can only belong to registered authors.',
      );
    }

    return { authorId: targetAuthor.id };
  }
}
