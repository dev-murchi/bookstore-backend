import { Injectable } from '@nestjs/common';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CustomAPIError } from '../common/errors/custom-api.error';

export type SortType = 'asc' | 'desc';

const selectedBookInformations = {
  id: true,
  title: true,
  author: {
    select: {
      userid: true,
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
};

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}
  async create(authorId: string, createBookDto: CreateBookDto) {
    try {
      // check book is exist or not
      const book = await this.prisma.books.findUnique({
        where: { isbn: createBookDto.isbn },
        select: { id: true },
      });

      if (book)
        throw new CustomAPIError('The book with same ISBN is already exist');

      // save the book
      const savedBook = await this.prisma.books.create({
        data: {
          title: createBookDto.title,
          author: {
            connect: {
              userid: authorId,
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
    } catch (error) {
      console.error('Book creation failed. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new CustomAPIError('Book creation failed.');
    }
  }

  async findAll() {
    try {
      const books = await this.prisma.books.findMany({
        orderBy: { id: 'asc' },
        select: selectedBookInformations,
      });

      return books;
    } catch (error) {
      console.error('Books could not fetched. Error:', error);
      throw new CustomAPIError('Books could not fetched.');
    }
  }

  async findOne(id: number) {
    try {
      const book = await this.prisma.books.findUnique({
        where: { id },
        select: selectedBookInformations,
      });

      return book;
    } catch (error) {
      console.error('Book could be fetched. Error:', error);
      throw new CustomAPIError('Book could be fetched.');
    }
  }

  async update(id: number, updateBookDto: UpdateBookDto, authorId: string) {
    try {
      const {
        title,
        isbn,
        price,
        categoryId,
        description,
        stockQuantity,
        imageUrl,
      } = updateBookDto;

      if (
        !title &&
        !isbn &&
        !price &&
        !categoryId &&
        !description &&
        !stockQuantity &&
        !imageUrl
      ) {
        throw new CustomAPIError('No changes provided.');
      }

      const data: Prisma.booksUpdateInput = {};

      if (title) data.title = title;
      if (isbn) data.isbn = isbn;
      if (price) data.price = price;
      if (categoryId)
        data.category = {
          connect: {
            id: categoryId,
          },
        };
      if (description) data.description = description;
      if (stockQuantity) data.stock_quantity = stockQuantity;

      if (imageUrl) data.image_url = imageUrl;

      await this.prisma.books.update({
        where: { id, authorid: authorId },
        data: data,
      });
      return { message: 'Book informations updated successfully' };
    } catch (error) {
      console.error('Book informations could not be updated. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new CustomAPIError('Book informations could not be updated');
    }
  }

  async remove(id: number) {
    try {
      await this.prisma.books.delete({
        where: { id },
      });
      return { message: 'Book deleted successfully' };
    } catch (error) {
      console.error('Book could not be deleted. Error:', error);
      throw new CustomAPIError('Book could not be deleted');
    }
  }

  async search(searchQuery: string) {
    try {
      return await this.prisma.books.findMany({
        where: {
          OR: [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            {
              author: { name: { contains: searchQuery, mode: 'insensitive' } },
            },
            { isbn: { contains: searchQuery, mode: 'insensitive' } },
            {
              category: {
                category_name: { contains: searchQuery, mode: 'insensitive' },
              },
            },
          ],
        },
        select: selectedBookInformations,
      });
    } catch (error) {
      console.error('Search for the book(s) failed. Error:', error);
      throw new CustomAPIError('Search for the book(s) failed.');
    }
  }

  async filter(filterParams: {
    minPrice?: number;
    maxPrice?: number;
    rating?: number;
    stock?: boolean;
    orderBy: SortType;
  }) {
    try {
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
        select: selectedBookInformations,
        orderBy: [{ price: orderBy }, { rating: orderBy }],
      });
    } catch (error) {
      console.error('Filter operation for book(s) failed. Error:', error);
      throw new CustomAPIError('Filter operation for book(s) failed.');
    }
  }
}
