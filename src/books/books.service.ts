import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type SortType = 'asc' | 'desc';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}
  async create(authorId: number, createBookDto: CreateBookDto) {
    // check book is exist or not
    const book = await this.prisma.books.findUnique({
      where: { isbn: createBookDto.isbn },
      select: { id: true },
    });

    if (book)
      throw new BadRequestException('The book with same ISBN is already exist');

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
      orderBy: { id: 'asc' },
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

  async update(id: number, updateBookDto: UpdateBookDto, authorId: number) {
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

      if (Object.keys(data).length === 0)
        return { message: 'No changes to update' };

      await this.prisma.books.update({
        where: { id, authorid: authorId },
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

  async search(searchQuery: string) {
    return await this.prisma.books.findMany({
      where: {
        OR: [
          { title: { contains: searchQuery, mode: 'insensitive' } },
          { author: { name: { contains: searchQuery, mode: 'insensitive' } } },
          { isbn: { contains: searchQuery, mode: 'insensitive' } },
          {
            category: {
              category_name: { contains: searchQuery, mode: 'insensitive' },
            },
          },
        ],
      },
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
  }

  async filter(filterParams: {
    minPrice?: number;
    maxPrice?: number;
    rating?: number;
    stock?: boolean;
    orderBy: SortType;
  }) {
    let price = {};
    let rating = {};
    let stock_quantity = {};

    // minimum price
    if (filterParams.minPrice >= 0) {
      price = { ...price, gte: filterParams.minPrice };
    }

    // maximum price
    if (filterParams.maxPrice >= 0) {
      price = { ...price, lte: filterParams.maxPrice };
    }

    // minimum rating
    if (filterParams.rating >= 0) {
      rating = { ...rating, gte: filterParams.rating };
    }

    const orderBy = filterParams.orderBy;

    if (undefined !== filterParams.stock) {
      stock_quantity = filterParams.stock
        ? { ...stock_quantity, gt: 0 }
        : { ...stock_quantity, equals: 0 };
    }

    const conditions: Prisma.booksWhereInput = {
      price,
      rating,
      stock_quantity,
    };

    return await this.prisma.books.findMany({
      where: conditions,
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
      orderBy: [{ price: orderBy }, { rating: orderBy }],
    });
  }
}
