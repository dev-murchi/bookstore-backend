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
  ParseFloatPipe,
  ParseBoolPipe,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException,
  ParseUUIDPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { Request } from 'express';
import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/role.enum';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { UserService } from '../user/user.service';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { BookDTO } from './dto/book.dto';
import { BookReviewDTO } from './dto/book-review.dto';
import { ReviewsService } from '../reviews/reviews.service';
import { ReviewDTO } from '../reviews/dto/review.dto';
import { CreateReviewDTO } from '../reviews/dto/create-review.dto';
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
} from '@nestjs/swagger';

@ApiTags('Books')
@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private userService: UserService,
    private reviewsService: ReviewsService,
  ) {}

  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin, RoleEnum.Author])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new book (Author and Admin only)' })
  @ApiBody({ type: CreateBookDto })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Book successfully created', type: BookDTO })
  @ApiBadRequestResponse({ description: 'Validation or business logic error' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  async create(
    @Req() request: Request,
    @Body() createBookDto: CreateBookDto,
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
  @ApiOkResponse({ description: 'List of all books', type: [BookDTO] })
  @ApiInternalServerErrorResponse({ description: 'Failed to retrieve books' })
  async findAll(): Promise<{ data: BookDTO[] }> {
    try {
      return { data: await this.booksService.findAll() };
    } catch (error) {
      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }

      throw new InternalServerErrorException('User could not be fetched.');
    }
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search books by keyword' })
  @ApiQuery({ name: 'search', required: true, type: String })
  @ApiOkResponse({
    description: 'Books matching the search query',
    type: [BookDTO],
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
  @ApiQuery({ name: 'minPrice', type: Number, required: false })
  @ApiQuery({ name: 'maxPrice', type: Number, required: false })
  @ApiQuery({ name: 'rating', type: Number, required: false })
  @ApiQuery({ name: 'stock', type: Boolean, required: false })
  @ApiQuery({ name: 'sort', enum: ['asc', 'desc'], required: false })
  @ApiOkResponse({ description: 'Filtered list of books', type: [BookDTO] })
  async filter(
    @Query('minPrice', ParseFloatPipe) minPrice?: number,
    @Query('maxPrice', ParseFloatPipe) maxPrice?: number,
    @Query('rating', ParseIntPipe) rating?: number,
    @Query('stock', ParseBoolPipe) stock?: boolean,
    @Query('sort') sort?: 'asc' | 'desc',
  ): Promise<{ data: BookDTO[] }> {
    try {
      const orderBy = sort === 'desc' ? 'desc' : 'asc';
      const filteredBooks = await this.booksService.filter({
        minPrice,
        maxPrice,
        rating,
        stock,
        orderBy,
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
  @ApiOkResponse({ description: 'Book found', type: BookDTO })
  @ApiInternalServerErrorResponse({ description: 'Book retrieval failed' })
  async findOne(@Param('id') id: string): Promise<{ data: BookDTO }> {
    try {
      const book = await this.booksService.findOne(id);
      return { data: book };
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException(
        'Failed to update the book due to an unexpected error',
      );
    }
  }

  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin, RoleEnum.Author])
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update book by ID (Author and Admin only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateBookDto })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Book updated', type: BookDTO })
  @ApiBadRequestResponse({ description: 'Bad request' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized to update' })
  @ApiInternalServerErrorResponse({ description: 'Failed to update book' })
  async update(
    @Req() request: Request,
    @Param('id', ParseIntPipe) bookId: string,
    @Body() updateBookDto: UpdateBookDto,
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
      if (error instanceof NotFoundException) throw error;
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
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.User])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit a review for a book (Authenticated User only)',
  })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: BookReviewDTO })
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Review submitted', type: ReviewDTO })
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
      example: {
        data: {
          data: {
            reviews: [
              {
                id: 1,
                data: 'Excellent insights on travel!',
                rating: 5,
                book: 'uuid-book-id',
                owner: 'uuid-user-id',
              },
            ],
            rating: 4.8,
          },
          meta: {
            bookId: 'uuid-book-id',
            totalReviewCount: 1,
            page: 1,
            limit: 10,
            totalPages: 1,
          },
        },
      },
    },
  })
  async findBookReviews(
    @Param('id', ParseUUIDPipe) bookId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number = 10,
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
