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
import { Book } from '../common/types';

@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private userService: UserService,
  ) {}

  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin, RoleEnum.Author])
  @Post()
  async create(
    @Req() request: Request,
    @Body() createBookDto: CreateBookDto,
  ): Promise<{ data: Book }> {
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
  async findAll(): Promise<{ data: Book[] }> {
    try {
      return { data: await this.booksService.findAll() };
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException('User could not be fetched.');
    }
  }

  @Get('search')
  async search(@Query('search') query: string): Promise<{ data: Book[] }> {
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
  ): Promise<{ data: Book[] }> {
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
  async findOne(@Param('id') id: string): Promise<{ data: Book }> {
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
    @Param('id', ParseIntPipe) bookId: string,
    @Body() updateBookDto: UpdateBookDto,
  ): Promise<{ data: Book }> {
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

      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException(
        'Failed to update book due to an unexpected error.',
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

    if (targetAuthor.role.value !== RoleEnum.Author) {
      throw new BadRequestException(
        'Books can only belong to registered authors.',
      );
    }

    return { authorId: targetAuthor.id };
  }
}
