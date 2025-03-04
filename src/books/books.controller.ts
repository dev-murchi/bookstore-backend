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
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { Request } from 'express';
import { AuthGuard } from '../guard/auth/auth.guard';
import { RoleGuard } from '../guard/role/role.guard';
import { Role } from '../decorator/role/role.decorator';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @UseGuards(AuthGuard, RoleGuard)
  @Role('author')
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

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return { data: await this.booksService.findOne(id) };
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Role('author')
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

  @UseGuards(AuthGuard, RoleGuard)
  @Role('author')
  @Delete(':id')
  async remove(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    return { data: await this.booksService.remove(id) };
  }
}
