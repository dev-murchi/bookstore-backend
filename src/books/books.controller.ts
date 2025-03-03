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
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { Request } from 'express';
import { AuthGuard } from '../guard/auth/auth.guard';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @UseGuards(AuthGuard)
  @Post()
  async create(@Req() request: Request, @Body() createBookDto: CreateBookDto) {
    // check user validity
    if (request.user['role']['name'] !== 'user')
      throw new UnauthorizedException(
        'Only author can perform this opearation',
      );

    return await this.booksService.create(request.user['id'], createBookDto);
  }

  @Get()
  async findAll() {
    return await this.booksService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const book = await this.booksService.findOne(id);

    if (!book)
      throw new NotFoundException(`The book with ID:#${id} is not found`);

    return book;
  }

  @UseGuards(AuthGuard)
  @Patch(':id')
  async update(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBookDto: UpdateBookDto,
  ) {
    if (request.user['role']['name'] !== 'author')
      throw new UnauthorizedException(
        'Only author can perform this opearation',
      );
    return await this.booksService.update(id, updateBookDto);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  async remove(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    if (request.user['role']['name'] !== 'author')
      throw new UnauthorizedException(
        'Only author can perform this opearation',
      );
    return await this.booksService.remove(id);
  }
}
