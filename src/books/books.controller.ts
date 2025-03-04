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
import { RoleGuard } from '../guard/role/role.guard';
import { Role } from '../decorator/role/role.decorator';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @UseGuards(AuthGuard, RoleGuard)
  @Role('author')
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

  @UseGuards(AuthGuard, RoleGuard)
  @Role('author')
  @Patch(':id')
  async update(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBookDto: UpdateBookDto,
  ) {
    return await this.booksService.update(id, updateBookDto);
  }

  @UseGuards(AuthGuard, RoleGuard)
  @Role('author')
  @Delete(':id')
  async remove(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    return await this.booksService.remove(id);
  }
}
