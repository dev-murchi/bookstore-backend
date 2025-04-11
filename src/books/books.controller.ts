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

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin, RoleEnum.Author])
  @Post()
  async create(@Req() request: Request, @Body() createBookDto: CreateBookDto) {
    try {
      return {
        data: await this.booksService.create(request.user['id'], createBookDto),
      };
    } catch (error) {
      throw new BadRequestException('Could not created');
    }
  }

  @Get()
  async findAll() {
    return { data: await this.booksService.findAll() };
  }

  @Get('search')
  async search(@Query('search') query: string) {
    if (!query) return { data: [] };
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
    return {
      data: await this.booksService.update(
        bookId,
        updateBookDto,
        request.user['id'],
      ),
    };
  }

  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin, RoleEnum.Author])
  @Delete(':id')
  async remove(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    return { data: await this.booksService.remove(id) };
  }
}
