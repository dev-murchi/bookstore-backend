import { Injectable } from '@nestjs/common';
import { CreateBookDTO } from '../common/dto/create-book.dto';
import { UpdateBookDTO } from '../common/dto/update-book.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { BookDTO } from '../common/dto/book.dto';
import { CategoryDTO } from '../common/dto/category.dto';

export type SortType = 'asc' | 'desc';

const selectedBookInformations: Prisma.booksSelect = {
  id: true,
  title: true,
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { role_name: true } },
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

type SelectedBook = Prisma.booksGetPayload<{
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

      const book = await this.prisma.books.update({
        where: {
          id,
          authorid: authorId,
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
      await this.prisma.books.delete({
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
      const condditions: Prisma.booksWhereInput = {
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
        rating = { gte: Math.ceil(filterParams.rating) };
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

  private async findBook(conditions: Prisma.booksWhereUniqueInput) {
    return await this.prisma.books.findUnique({
      where: conditions,
      select: selectedBookInformations,
    });
  }

  private async findBooks(
    conditions: Prisma.booksWhereInput,
    orderBy?: Prisma.booksOrderByWithRelationInput[],
  ) {
    return await this.prisma.books.findMany({
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
      new CategoryDTO(book.category.id, book.category.category_name),
      Number(book.price.toFixed(2)),
      book.rating,
      book.image_url,
    );
  }
}
