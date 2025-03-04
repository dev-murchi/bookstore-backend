import { Test, TestingModule } from '@nestjs/testing';
import { BooksService } from './books.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

const mockPrismaService = {
  books: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('BooksService', () => {
  let service: BooksService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw an error if book ISBN is already in use', async () => {
      const isbn = '9780743273565';
      mockPrismaService.books.findUnique.mockResolvedValueOnce({
        id: 1,
        title: 'The Old Book',
        authorid: 2,
        categoryid: 3,
        isbn: isbn,
        price: 10.99,
        description: 'Old book description',
        stock_quantity: 100,
        rating: 4.7,
        image_url: 'image-url',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const userId = 1;
      const bookDto = {
        title: 'The Test Book',
        categoryId: 1,
        isbn: isbn,
        price: 1,
        description: 'Test book description.',
        stockQuantity: 1,
        imageUrl: 'testbook-image-url',
        isActive: true,
      };

      try {
        await service.create(userId, bookDto);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('The book with same ISBN is already exist');
        expect(prisma.books.create).toHaveBeenCalledTimes(0);
      }
    });

    it('should successfully create a book if ISBN is not taken', async () => {
      const userId = 1;
      const bookDto = {
        title: 'The Test Book',
        categoryId: 1,
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stockQuantity: 1,
        imageUrl: 'testbook-image-url',
        isActive: true,
      };

      mockPrismaService.books.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.books.create.mockResolvedValueOnce({
        id: 1,
        title: bookDto.title,
        authorid: userId,
        categoryid: bookDto.categoryId,
        isbn: bookDto.isbn,
        price: bookDto.price,
        description: bookDto.description,
        stock_quantity: bookDto.stockQuantity,
        rating: 5,
        image_url: bookDto.imageUrl,
        is_active: bookDto.isActive,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.create(userId, bookDto);

      expect(result).toEqual({
        message: 'Book is created successfully',
        id: 1,
      });
    });
  });

  describe('finAll', () => {
    it('should return empty array if there is no book', async () => {
      mockPrismaService.books.findMany.mockResolvedValueOnce(null);
      expect(await service.findAll()).toEqual([]);
    });

    it('should return all books', async () => {
      const book = {
        id: 1,
        title: 'The Test Book',
        authorid: 1,
        categoryid: 1,
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stock_quantity: 1,
        rating: 5,
        image_url: 'testbook-image-url',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockPrismaService.books.findMany.mockResolvedValueOnce([book]);
      expect(await service.findAll()).toEqual([book]);
    });
  });

  describe('findOne', () => {
    it('should return null if there is no book', async () => {
      mockPrismaService.books.findUnique.mockResolvedValueOnce(null);
      const id = 1;
      expect(await service.findOne(id)).toBeNull();
    });
    it('should a book by id', async () => {
      const bookId = 1;
      const book = {
        id: bookId,
        title: 'The Test Book',
        authorid: 1,
        categoryid: 1,
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stock_quantity: 1,
        rating: 5,
        image_url: 'testbook-image-url',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockPrismaService.books.findUnique.mockResolvedValueOnce(book);
      expect(await service.findOne(bookId)).toEqual(book);
    });
  });

  describe('update', () => {
    it('should return a message when no fields are provided for update', async () => {
      const updateBookDto = {};
      const authorId = 1;
      const result = await service.update(1, updateBookDto, authorId);
      expect(result).toEqual({ message: 'No changes to update' });
      expect(prisma.books.update).toHaveBeenCalledTimes(0);
    });

    it('should successfully update book information', async () => {
      const updateBookDto = {
        title: 'Updated Book Title',
        isbn: '1234567890123',
        price: 20,
        categoryId: 1,
        description: 'Updated description.',
        stockQuantity: 10,
        imageUrl: 'image-url',
        isActive: true,
      };

      const bookId = 1;
      const authorId = 1;

      const book = {
        id: bookId,
        title: updateBookDto.title,
        authorid: authorId,
        categoryid: updateBookDto.categoryId,
        isbn: updateBookDto.isbn,
        price: updateBookDto.price,
        description: updateBookDto.description,
        stock_quantity: updateBookDto.stockQuantity,
        rating: 5,
        image_url: updateBookDto.imageUrl,
        is_active: updateBookDto.isActive,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockPrismaService.books.findUnique.mockResolvedValueOnce(book);

      const result = await service.update(bookId, updateBookDto, authorId);

      expect(result).toEqual({
        message: 'Book informations updated successfully',
      });
      expect(prisma.books.update).toHaveBeenCalledWith({
        where: { id: bookId, authorid: authorId },
        data: {
          title: updateBookDto.title,
          isbn: updateBookDto.isbn,
          price: updateBookDto.price,
          category: {
            connect: { id: updateBookDto.categoryId },
          },
          description: updateBookDto.description,
          stock_quantity: updateBookDto.stockQuantity,
          image_url: updateBookDto.imageUrl,
        },
      });
    });

    it('should not update fields that are undefined', async () => {
      const updateBookDto = {
        title: undefined,
        isbn: undefined,
        price: 10,
        categoryId: undefined,
        description: undefined,
        stockQuantity: 50,
        imageUrl: undefined,
        isActive: undefined,
      };

      const bookId = 1;
      const authorId = 1;

      const book = {
        id: bookId,
        title: 'Book Title',
        authorid: authorId,
        categoryid: 1,
        isbn: '1234567890123',
        price: updateBookDto.price,
        description: 'Book description',
        stock_quantity: updateBookDto.stockQuantity,
        rating: 5,
        image_url: 'image-url',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockPrismaService.books.findUnique.mockResolvedValueOnce(book);

      const result = await service.update(bookId, updateBookDto, authorId);

      expect(result).toEqual({
        message: 'Book informations updated successfully',
      });
      expect(prisma.books.update).toHaveBeenCalledWith({
        where: { id: bookId, authorid: authorId },
        data: {
          price: updateBookDto.price,
          stock_quantity: updateBookDto.stockQuantity,
        },
      });
    });

    it('should throw BadRequestException error if update is failes', async () => {
      const updateBookDto = {
        title: 'Updated Book Title',
        isbn: '1234567890123',
        price: 20,
        categoryId: 1,
        description: 'Updated description.',
        stockQuantity: 10,
        imageUrl: 'image-url',
        isActive: true,
      };

      const bookId = 1;
      const authorId = 1;
      mockPrismaService.books.update.mockRejectedValueOnce('Update failed.');
      try {
        await service.update(bookId, updateBookDto, authorId);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Book informations could not be updated');
      }
    });
  });

  describe('remove', () => {
    it('should throw an error if book does not exist', async () => {
      mockPrismaService.books.delete.mockRejectedValueOnce('Delete failed');
      const bookId = 1;
      try {
        await service.remove(bookId);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Book could not be deleted');
      }
    });

    it('should successfully delete a book', async () => {
      const bookId = 1;
      const book = {
        id: bookId,
        title: 'The Test Book',
        authorid: 1,
        categoryid: 1,
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stock_quantity: 1,
        rating: 5,
        image_url: 'testbook-image-url',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockPrismaService.books.delete.mockResolvedValueOnce(book);
      const result = await service.remove(bookId);
      expect(result).toEqual({ message: 'Book deleted successfully' });
    });
  });
});
