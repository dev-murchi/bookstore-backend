import { Injectable } from '@nestjs/common';
import { CreateBookDTO } from 'src/common/dto/create-book.dto';
import { UpdateBookDTO } from 'src/common/dto/update-book.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { BookDTO } from 'src/common/dto/book.dto';
import { CategoryDTO } from 'src/common/dto/category.dto';

export type SortType = 'asc' | 'desc';

const selectedBookInformations: Prisma.BookSelect = {
  id: true,
  title: true,
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { name: true } },
    },
  },
  category: { select: { name: true } },
  isbn: true,
  price: true,
  description: true,
  stockQuantity: true,
  rating: true,
  imageUrl: true,
};

type SelectedBook = Prisma.BookGetPayload<{
  select: typeof selectedBookInformations;
}>;

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}
  async create(
    authorId: string,
    createBookDto: CreateBookDTO,
  ): Promise<BookDTO> {
    try {
      // check book is exist or not
      const book = await this.findBook({ isbn: createBookDto.isbn });

      if (book)
        throw new CustomAPIError('The book with same ISBN is already exist');

      // save the book
      const savedBook = await this.prisma.book.create({
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
          stockQuantity: createBookDto.stockQuantity,
          imageUrl: createBookDto.imageUrl,
          isActive: createBookDto.isActive,
        },
        select: selectedBookInformations,
      });

      return this.transformBookData(savedBook);
    } catch (error) {
      console.error('Book creation failed. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new CustomAPIError('Book creation failed.');
    }
  }

  async findAll(): Promise<BookDTO[]> {
    try {
      const books = await this.findBooks({}, [{ title: 'asc' }]);

      return books.map((book) => this.transformBookData(book));
    } catch (error) {
      console.error('Books could not retrieved. Error:', error);
      throw new CustomAPIError('Books could not retrieved.');
    }
  }

  async findOne(id: string): Promise<BookDTO | null> {
    try {
      const book = await this.findBook({ id });
      if (!book) return null;
      return this.transformBookData(book);
    } catch (error) {
      console.error('Book could be retrieved. Error:', error);
      throw new CustomAPIError('Book could not retrieved.');
    }
  }

  async update(
    id: string,
    updateBookDto: UpdateBookDTO,
    authorId: string,
  ): Promise<BookDTO> {
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

      const data: Prisma.BookUpdateInput = {};

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
      if (stockQuantity) data.stockQuantity = stockQuantity;

      if (imageUrl) data.imageUrl = imageUrl;

      const book = await this.prisma.book.update({
        where: {
          id,
          authorId: authorId,
        },
        data: data,
        select: selectedBookInformations,
      });

      return this.transformBookData(book);
    } catch (error) {
      console.error('Book informations could not be updated. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new CustomAPIError('Book informations could not be updated');
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      await this.prisma.book.delete({
        where: { id },
      });
      return { message: 'Book deleted successfully' };
    } catch (error) {
      console.error('Book could not be deleted. Error:', error);
      throw new CustomAPIError('Book could not be deleted');
    }
  }

  async search(searchQuery: string): Promise<BookDTO[]> {
    try {
      const condditions: Prisma.BookWhereInput = {
        OR: [
          { title: { contains: searchQuery, mode: 'insensitive' } },
          {
            author: { name: { contains: searchQuery, mode: 'insensitive' } },
          },
          { isbn: { contains: searchQuery, mode: 'insensitive' } },
          {
            category: {
              name: { contains: searchQuery, mode: 'insensitive' },
            },
          },
        ],
      };
      const books = await this.findBooks(condditions);

      return books.map((book) => this.transformBookData(book));
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
      let stockQuantity = {};

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
        rating = { gte: Math.ceil(filterParams.rating) };
      }

      const orderBy = filterParams.orderBy;

      if (undefined !== filterParams.stock) {
        stockQuantity = filterParams.stock
          ? { ...stockQuantity, gt: 0 }
          : { ...stockQuantity, equals: 0 };
      }

      const conditions: Prisma.BookWhereInput = {
        price,
        rating,
        stockQuantity,
      };

      const books = await this.findBooks(conditions, [
        { price: orderBy },
        { rating: orderBy },
      ]);

      return books.map((book) => this.transformBookData(book));
    } catch (error) {
      console.error('Filter operation for book(s) failed. Error:', error);
      throw new CustomAPIError('Filter operation for book(s) failed.');
    }
  }

  private async findBook(conditions: Prisma.BookWhereUniqueInput) {
    return await this.prisma.book.findUnique({
      where: conditions,
      select: selectedBookInformations,
    });
  }

  private async findBooks(
    conditions: Prisma.BookWhereInput,
    orderBy?: Prisma.BookOrderByWithRelationInput[],
  ) {
    return await this.prisma.book.findMany({
      where: conditions,
      select: selectedBookInformations,
      orderBy: orderBy ? orderBy : {},
    });
  }

  private transformBookData(book: SelectedBook): BookDTO {
    return new BookDTO(
      book.id,
      book.title,
      book.description,
      book.isbn,
      { name: book.author.name },
      new CategoryDTO(book.category.id, book.category.name),
      Number(book.price.toFixed(2)),
      book.rating,
      book.imageUrl,
    );
  }
}
