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
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { Request } from 'express';
import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/role.enum';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { UserService } from '../user/user.service';

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
      if (error instanceof BadRequestException) throw error;

      console.error('Unexpected error during book creation:', error);
      throw new BadRequestException(
        'Failed to create book due to an unexpected error.',
      );
    }
  }

  @Get()
  async findAll() {
    return { data: await this.booksService.findAll() };
  }

  @Get('search')
  async search(@Query('search') query: string) {
    if (!query) return { data: [] };
    if (query.length < 3)
      throw new BadRequestException(
        'The query must contain at least three characters.',
      );
    return { data: await this.booksService.search(query) };
  }

  @Get('filter')
  async filter(
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('rating') rating?: number | undefined,
    @Query('stock') stock?: boolean,
    @Query('sort') sort?: 'asc' | 'desc',
  ) {
    const orderBy = sort === 'desc' ? 'desc' : 'asc';

    return await this.booksService.filter({
      minPrice,
      maxPrice,
      rating,
      stock,
      orderBy,
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.booksService.findOne(id) };
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

      if (book.author.id !== targetAuthor.id) {
        throw new BadRequestException(
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
      if (error instanceof BadRequestException) throw error;

      if (error.message === 'Book not found.') {
        throw new BadRequestException(
          'The book you are trying to update does not exist.',
        );
      }

      console.error('Unexpected error during book update:', error);
      throw new BadRequestException(
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

      const isAuthorRole = targetAuthor.role.role_name === RoleEnum.Author;
      if (!isAuthorRole) {
        throw new BadRequestException(
          'Books can only belong to registered authors.',
        );
      }

      const isAdmin = requestUser.role === RoleEnum.Admin;
      const isSelf = requestUser.email === targetAuthor.email;

      if (!isAdmin && !isSelf) {
        throw new BadRequestException(
          `You are not authorized to ${operation} a book for this author.`,
        );
      }

      return { targetAuthor };
    } catch (error) {
      if (error.message === 'User not found.') {
        throw new BadRequestException(
          `Please ensure the author exists before ${operation}ing a book.`,
        );
      }
      throw error;
    }
  }
}
