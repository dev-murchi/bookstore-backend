import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Req,
  UseGuards,
  BadRequestException,
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
      const requestingUser = request.user;
      const targetAuthor = await this.userService.findBy(createBookDto.author);

      if (targetAuthor.role.role_name !== RoleEnum.Author) {
        throw new BadRequestException(
          'Books can only belong to registered authors.',
        );
      }

      const isAdmin = requestingUser['role'] === RoleEnum.Admin;
      const isAuthor = requestingUser['email'] === targetAuthor.email;

      // requesting user must be an admin or an author
      if (!isAdmin && !isAuthor)
        throw new BadRequestException(
          'You are not authorized to create a book for this author.',
        );

      const createdBook = await this.booksService.create(
        targetAuthor.id,
        createBookDto,
      );

      return { data: createdBook };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      if (error.message === 'User not found.') {
        throw new BadRequestException(
          'Please ensure the author exists before creating a book.',
        );
      }

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
      const requestingUser = request.user;
      // Find the author of the updated book
      const targetAuthor = await this.userService.findBy(updateBookDto.author);
      if (!targetAuthor) {
        throw new BadRequestException('Specified author does not exist.');
      }

      // Find the book to update
      const book = await this.booksService.findOne(bookId);
      if (!book) {
        throw new BadRequestException(
          'The book you are trying to update does not exist.',
        );
      }

      // Admin check: Admins can update any book as long as the author exists
      if (requestingUser['role'] === RoleEnum.Admin) {
        // Admin can only update books if the author is correct
        if (book.author.id !== targetAuthor.id) {
          throw new BadRequestException(
            'You are not authorized to update this book.',
          );
        }
      } else {
        // Author check: Authors can only update their own books
        if (requestingUser['id'] !== book.author.id) {
          throw new BadRequestException(
            'You can only update books that belong to you.',
          );
        }
      }

      // Update the book
      const updatedBook = await this.booksService.update(
        bookId,
        updateBookDto,
        book.author.id,
      );

      return {
        data: updatedBook,
      };
    } catch (error) {
      console.error('Error while updating book:', error);
      throw new BadRequestException(
        'Failed to update the book. Please try again later.',
      );
    }
  }

  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin, RoleEnum.Author])
  @Delete(':id')
  async remove(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    return { data: await this.booksService.remove(id) };
  }
}
