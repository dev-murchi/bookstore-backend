import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}
  async create(authorId: number, createBookDto: CreateBookDto) {
    // check book is exist or not
    const book = await this.prisma.books.findUnique({
      where: { isbn: createBookDto.isbn },
    });

    if (book) throw new Error('The book with same ISBN is already exist');

    // save the book
    const savedBook = await this.prisma.books.create({
      data: {
        title: createBookDto.title,
        author: {
          connect: {
            id: authorId,
          },
        },
        category: {
          connect: {
            id: createBookDto.categoryId,
          },
        },
        isbn: createBookDto.isbn,
        price: createBookDto.price,
        description: createBookDto.description,
        stock_quantity: createBookDto.stockQuantity,
        image_url: createBookDto.imageUrl,
        is_active: createBookDto.isActive,
      },
    });

    return {
      message: 'Book is created successfully',
      id: savedBook.id,
    };
  }

  async findAll() {
    const books = await this.prisma.books.findMany({
      select: {
        id: true,
        title: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        category: { select: { category_name: true } },
        isbn: true,
        price: true,
        description: true,
        stock_quantity: true,
        rating: true,
        image_url: true,
      },
    });
    if (!books) return [];
    return books;
  }

  async findOne(id: number) {
    const book = await this.prisma.books.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        category: { select: { category_name: true } },
        isbn: true,
        price: true,
        description: true,
        stock_quantity: true,
        rating: true,
        image_url: true,
      },
    });

    if (!book) return null;
    return book;
  }

  async update(id: number, updateBookDto: UpdateBookDto) {
    try {
      const data: Prisma.booksUpdateInput = {};

      if (updateBookDto.title) data.title = updateBookDto.title;
      if (updateBookDto.isbn) data.isbn = updateBookDto.isbn;
      if (updateBookDto.price) data.price = updateBookDto.price;
      if (updateBookDto.categoryId)
        data.category = {
          connect: {
            id: updateBookDto.categoryId,
          },
        };
      if (updateBookDto.description)
        data.description = updateBookDto.description;
      if (updateBookDto.stockQuantity)
        data.stock_quantity = updateBookDto.stockQuantity;

      if (updateBookDto.imageUrl) data.image_url = updateBookDto.imageUrl;

      await this.prisma.books.update({
        where: { id },
        data: data,
      });
      return { message: 'Book informations updated successfully' };
    } catch (error) {
      throw new BadRequestException('Book informations could not be updated');
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.books.delete({
        where: { id },
      });
      return { message: 'Book deleted successfully' };
    } catch (error) {
      throw new BadRequestException('Book could not be deleted');
    }
  }
}
