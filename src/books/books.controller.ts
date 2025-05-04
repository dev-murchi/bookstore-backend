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

@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private userService: UserService,
  ) {}

  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin, RoleEnum.Author])
  @Post()
  async create(@Req() request: Request, @Body() createBookDto: CreateBookDto) {
    try {
      const { targetAuthor } = await this.validateAuthorAndAuthorize(
        { email: request.user['email'], role: request.user['role'] },
        createBookDto.author,
        'create',
      );

      const createdBook = await this.booksService.create(
        targetAuthor.id,
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
  async findAll() {
    try {
      return { data: await this.booksService.findAll() };
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException('User could not be fetched.');
    }
  }

  @Get('search')
  async search(@Query('search') query: string) {
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
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException(
        'Failed to search the book due to an unexpected error.',
      );
    }
  }

  @Get('filter')
  async filter(
    @Query('minPrice', ParseFloatPipe) minPrice?: number,
    @Query('maxPrice', ParseFloatPipe) maxPrice?: number,
    @Query('rating', ParseIntPipe) rating?: number,
    @Query('stock', ParseBoolPipe) stock?: boolean,
    @Query('sort') sort?: 'asc' | 'desc',
  ) {
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

      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException(
        'Failed to filter the books due to an unexpected error.',
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
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
  async update(
    @Req() request: Request,
    @Param('id', ParseIntPipe) bookId: number,
    @Body() updateBookDto: UpdateBookDto,
  ) {
    try {
      const { targetAuthor } = await this.validateAuthorAndAuthorize(
        { email: request.user['email'], role: request.user['role'] },
        updateBookDto.author,
        'update',
      );

      const book = await this.booksService.findOne(bookId);

      if (!book)
        throw new NotFoundException(
          'The book you are trying to update does not exist.',
        );

      if (book.author.id !== targetAuthor.id) {
        throw new UnauthorizedException(
          `You are not authorized to update this book. Only the original author or an admin specifying the original author can update it.`,
        );
      }

      const updatedBook = await this.booksService.update(
        bookId,
        updateBookDto,
        book.author.id,
      );

      return {
        data: updatedBook,
      };
    } catch (error) {
      console.error('Failed to update book. Error:', error);
      if (error instanceof BadRequestException) throw error;
      if (error instanceof NotFoundException) throw error;
      if (error instanceof UnauthorizedException) throw error;

      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException(
        'Failed to update book due to an unexpected error.',
      );
    }
  }

  private async validateAuthorAndAuthorize(
    requestUser: { email: string; role: RoleEnum },
    authorIdentifier: string,
    operation: 'create' | 'update',
  ): Promise<{ targetAuthor: any }> {
    try {
      const targetAuthor = await this.userService.findBy(authorIdentifier);
      if (!targetAuthor)
        throw new BadRequestException(
          `Please ensure the author exists before ${operation}ing a book.`,
        );

      const isAuthorRole = targetAuthor.role.role_name === RoleEnum.Author;
      if (!isAuthorRole) {
        throw new BadRequestException(
          'Books can only belong to registered authors.',
        );
      }

      const isAdmin = requestUser.role === RoleEnum.Admin;
      const isSelf = requestUser.email === targetAuthor.email;

      if (!isAdmin && !isSelf) {
        throw new UnauthorizedException(
          `You are not authorized to ${operation} a book for this author.`,
        );
      }

      return { targetAuthor };
    } catch (error) {
      console.error('Failed to validate author and authorize action.', error);
      throw error;
    }
  }
}
