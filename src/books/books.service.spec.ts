import { Test, TestingModule } from '@nestjs/testing';
import { BooksService, SortType } from './books.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { CreateBookDTO } from 'src/common/dto/create-book.dto';
import { UpdateBookDTO } from 'src/common/dto/update-book.dto';
import { BookDTO } from 'src/common/dto/book.dto';
import { CategoryDTO } from 'src/common/dto/category.dto';

const mockUserId = '5610eb78-6602-4408-88f6-c2889cd136b7'; // just example
const mockUserId2 = '5610eb78-1234-4408-88f6-c2889cd136b7'; // just example
const mockBookId = 'ba22e8c2-8d5f-4ae2-835d-12f488667aed'; // just example
const mockBookId2 = 'ba22e8c2-1234-4ae2-835d-12f488667aed'; // just example
const mockBookId3 = 'ba22e8c2-1234-1234-835d-12f488667aed'; // just example
const mockBookId5 = 'ba22e8c2-1234-1234-1234-12f488667aed'; // just example
const mockBookId6 = 'ba22e8c2-1234-1234-835d-123488667aed'; // just example
const mockBookId7 = '1234e8c2-1234-1234-835d-123488667aed'; // just example
const mockPrismaService = {
  book: {
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw an error if book ISBN is already in use', async () => {
      const isbn = '9780743273565';
      mockPrismaService.book.findUnique.mockResolvedValueOnce({
        id: 1,
      });

      const createBookDto: CreateBookDTO = {
        title: 'The Test Book',
        categoryId: 1,
        isbn: isbn,
        price: 1,
        description: 'Test book description.',
        stockQuantity: 1,
        imageUrl: 'testbook-image-url',
        isActive: true,
        author: 'testauthor@email.com',
      };

      try {
        await service.create(mockUserId, createBookDto);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('The book with same ISBN is already exist');
        expect(prisma.book.create).toHaveBeenCalledTimes(0);
      }
    });

    it('should successfully create a book if ISBN is not taken', async () => {
      const createBookDto: CreateBookDTO = {
        title: 'The Test Book',
        categoryId: 1,
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stockQuantity: 1,
        imageUrl: 'testbook-image-url',
        isActive: true,
        author: 'testauthor@email.com',
      };

      mockPrismaService.book.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.book.create.mockResolvedValueOnce({
        id: mockBookId,
        title: 'The Test Book',
        author: {
          id: mockUserId,
          name: 'test author',
          email: 'testauthor@email.com',
          role: { name: 'author' },
        },
        category: { id: 1, name: 'category 1' },
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stockQuantity: 1,
        rating: 5,
        imageUrl: 'testbook-image-url',
      });

      const bookDTO = new BookDTO(
        mockBookId,
        'The Test Book',
        'Test book description.',
        '9780743273565',
        { name: 'test author' },
        new CategoryDTO(1, 'category 1'),
        1,
        5,
        'testbook-image-url',
      );

      const result = await service.create(mockUserId, createBookDto);

      expect(result).toEqual(bookDTO);
    });

    it('should throw CustomAPIError when an error occurs', async () => {
      mockPrismaService.book.findUnique.mockRejectedValueOnce(
        new Error('Error'),
      );

      try {
        const createBookDto: CreateBookDTO = {
          title: 'The Test Book',
          categoryId: 1,
          isbn: '9780743273565',
          price: 1,
          description: 'Test book description.',
          stockQuantity: 1,
          imageUrl: 'testbook-image-url',
          isActive: true,
          author: 'testauthor@email.com',
        };

        await service.create(mockUserId, createBookDto);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Book creation failed.');
      }
    });
  });

  describe('finAll', () => {
    it('should return empty array if there is no book', async () => {
      mockPrismaService.book.findMany.mockResolvedValueOnce([]);
      expect(await service.findAll()).toEqual([]);
    });

    it('should return all books', async () => {
      const book = {
        id: mockBookId,
        title: 'The Test Book',
        author: {
          id: mockUserId,
          name: 'test author',
          email: 'testauthor@email.com',
          role: { name: 'author' },
        },
        category: { id: 1, name: 'test-category' },
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stockQuantity: 1,
        rating: 5,
        imageUrl: 'testbook-image-url',
      };
      mockPrismaService.book.findMany.mockResolvedValueOnce([book]);
      expect(await service.findAll()).toEqual([
        new BookDTO(
          mockBookId,
          'The Test Book',
          'Test book description.',
          '9780743273565',
          { name: 'test author' },
          new CategoryDTO(1, 'test-category'),
          1,
          5,
          'testbook-image-url',
        ),
      ]);
    });

    it('should throw CustomAPIError when an error occurs', async () => {
      mockPrismaService.book.findMany.mockRejectedValueOnce(new Error('Error'));

      try {
        await service.findAll();
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Books could not retrieved.');
      }
    });
  });

  describe('findOne', () => {
    it('should return null if there is no book', async () => {
      mockPrismaService.book.findUnique.mockResolvedValueOnce(null);
      expect(await service.findOne(mockBookId)).toBeNull();
    });
    it('should return a book by id', async () => {
      const book = {
        id: mockBookId2,
        title: 'The Test Book 2',
        author: {
          id: mockUserId2,
          name: 'test author 2',
          email: 'testauthor2@email.com',
          role: { name: 'author' },
        },
        category: { id: 1, name: 'test-category-2' },
        isbn: '9780743273565',
        price: 2,
        description: 'Test book description.',
        stockQuantity: 2,
        rating: 4.5,
        imageUrl: 'testbook-image-url-2',
      };
      mockPrismaService.book.findUnique.mockResolvedValueOnce(book);
      expect(await service.findOne(mockBookId2)).toEqual(
        new BookDTO(
          mockBookId2,
          'The Test Book 2',
          'Test book description.',
          '9780743273565',
          { name: 'test author 2' },
          new CategoryDTO(1, 'test-category-2'),
          2,
          4.5,
          'testbook-image-url-2',
        ),
      );
    });
    it('should throw CustomAPIError when an error occurs', async () => {
      mockPrismaService.book.findUnique.mockRejectedValueOnce(
        new Error('Error'),
      );
      try {
        await service.findOne(mockBookId);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Book could not retrieved.');
      }
    });
  });

  describe('update', () => {
    it('should throw an error when no fields are provided for update', async () => {
      const updateBookDto: UpdateBookDTO = {
        author: 'testauthor@email.com',
      };

      try {
        await service.update(mockBookId, updateBookDto, mockUserId);
      } catch (error) {
        expect(error).toEqual(new CustomAPIError('No changes provided.'));
        expect(prisma.book.update).toHaveBeenCalledTimes(0);
      }
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
        author: 'testauthor@email.com',
      };

      mockPrismaService.book.update.mockResolvedValueOnce({
        id: mockBookId,
        title: 'Updated Book Title',
        author: {
          id: mockUserId,
          name: 'test author',
          email: 'testauthor@email.com',
          role: { name: 'author' },
        },
        category: { id: 1, name: 'test-category' },
        isbn: '1234567890123',
        price: 20,
        description: 'Updated description.',
        stockQuantity: 10,
        rating: 5,
        imageUrl: 'testbook-image-url',
      });
      const result = await service.update(
        mockBookId,
        updateBookDto,
        mockUserId,
      );

      expect(result).toEqual(
        new BookDTO(
          mockBookId,
          'Updated Book Title',
          'Updated description.',
          '1234567890123',
          { name: 'test author' },
          new CategoryDTO(1, 'test-category'),
          20,
          5,
          'testbook-image-url',
        ),
      );
      expect(prisma.book.update).toHaveBeenCalledWith({
        where: {
          authorId: mockUserId,
          id: mockBookId,
        },
        data: {
          title: updateBookDto.title,
          isbn: updateBookDto.isbn,
          price: updateBookDto.price,
          category: {
            connect: { id: updateBookDto.categoryId },
          },
          description: updateBookDto.description,
          stockQuantity: updateBookDto.stockQuantity,
          imageUrl: updateBookDto.imageUrl,
        },
        select: {
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
        author: 'testauthor@email.com',
      };

      mockPrismaService.book.update.mockResolvedValueOnce({
        id: mockBookId,
        title: 'Updated Book Title',
        author: {
          id: mockUserId,
          name: 'test author',
          email: 'testauthor@email.com',
          role: { name: 'author' },
        },
        category: { name: 'test-category' },
        isbn: '1234567890123',
        price: 10,
        description: 'Updated description.',
        stockQuantity: 50,
        rating: 5,
        imageUrl: 'testbook-image-url',
      });

      const result = await service.update(
        mockBookId,
        updateBookDto,
        mockUserId,
      );

      expect(result).toEqual({
        id: mockBookId,
        title: 'Updated Book Title',
        description: 'Updated description.',
        isbn: '1234567890123',
        author: {
          name: 'test author',
        },
        category: { value: 'test-category' },
        price: 10,
        rating: 5,
        imageUrl: 'testbook-image-url',
      });
      expect(prisma.book.update).toHaveBeenCalledWith({
        where: {
          id: mockBookId,
          authorId: mockUserId,
        },
        data: {
          price: updateBookDto.price,
          stockQuantity: updateBookDto.stockQuantity,
        },
        select: expect.any(Object),
      });
    });

    it('should throw an error if update is failes', async () => {
      const updateBookDto = {
        title: 'Updated Book Title',
        isbn: '1234567890123',
        price: 20,
        categoryId: 1,
        description: 'Updated description.',
        stockQuantity: 10,
        imageUrl: 'image-url',
        isActive: true,
        author: 'testauthor@email.com',
      };

      mockPrismaService.book.update.mockRejectedValueOnce('Update failed.');
      try {
        await service.update(mockBookId, updateBookDto, mockUserId);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Book informations could not be updated');
      }
    });
  });

  describe('remove', () => {
    it('should throw an error if book does not exist', async () => {
      mockPrismaService.book.delete.mockRejectedValueOnce('Delete failed');

      try {
        await service.remove(mockBookId);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Book could not be deleted');
      }
    });

    it('should successfully delete a book', async () => {
      mockPrismaService.book.delete.mockResolvedValueOnce({});
      const result = await service.remove(mockBookId);
      expect(result).toEqual({ message: 'Book deleted successfully' });
    });
  });

  describe('search', () => {
    it('should return books matching the search query in title', async () => {
      const book = {
        id: mockBookId,
        title: 'The Test Title Book',
        author: {
          id: mockUserId,
          name: 'test author',
          email: 'testauthor@email.com',
          role: { name: 'author' },
        },
        category: { name: 'test-category' },
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stockQuantity: 1,
        rating: 5,
        imageUrl: 'testbook-image-url',
      };

      mockPrismaService.book.findMany.mockResolvedValueOnce([book]);

      const result = await service.search('title');

      expect(result).toEqual([
        {
          id: mockBookId,
          title: 'The Test Title Book',
          description: 'Test book description.',
          isbn: '9780743273565',
          author: {
            name: 'test author',
          },
          category: {
            value: 'test-category',
          },
          price: 1,
          rating: 5,
          imageUrl: 'testbook-image-url',
        },
      ]);
      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: 'title', mode: 'insensitive' } },
            { author: { name: { contains: 'title', mode: 'insensitive' } } },
            { isbn: { contains: 'title', mode: 'insensitive' } },
            {
              category: {
                name: { contains: 'title', mode: 'insensitive' },
              },
            },
          ],
        },
        select: expect.any(Object),
        orderBy: {},
      });

      expect(mockPrismaService.book.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return books matching the search query in author', async () => {
      const book = {
        id: mockBookId,
        title: 'The Test Book',
        author: {
          id: mockUserId,
          name: 'test author user',
          email: 'testauthor@email.com',
          role: { name: 'author' },
        },
        category: { id: 1, name: 'test-category' },
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stockQuantity: 1,
        rating: 5,
        imageUrl: 'testbook-image-url',
      };

      mockPrismaService.book.findMany.mockResolvedValueOnce([book]);

      const result = await service.search('author');

      expect(result).toEqual([
        new BookDTO(
          mockBookId,
          'The Test Book',
          'Test book description.',
          '9780743273565',
          { name: 'test author user' },
          new CategoryDTO(1, 'test-category'),
          1,
          5,
          'testbook-image-url',
        ),
      ]);
    });

    it('should return books matching the search query in isbn', async () => {
      const book = {
        id: mockBookId,
        title: 'The Test Book',
        author: {
          id: mockUserId,
          name: 'test author user',
          email: 'testauthor@email.com',
          role: { name: 'author' },
        },
        category: { id: 1, name: 'test-category' },
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stockQuantity: 1,
        rating: 5,
        imageUrl: 'testbook-image-url',
      };

      mockPrismaService.book.findMany.mockResolvedValueOnce([book]);

      const result = await service.search('9780743273565');

      expect(result).toEqual([
        new BookDTO(
          mockBookId,
          'The Test Book',
          'Test book description.',
          '9780743273565',
          { name: 'test author user' },
          new CategoryDTO(1, 'test-category'),
          1,
          5,
          'testbook-image-url',
        ),
      ]);
    });

    it('should return books matching the search query in category', async () => {
      const book = {
        id: mockBookId,
        title: 'The Test Book',
        author: {
          id: mockUserId,
          name: 'test author user',
          email: 'testauthor@email.com',
          role: { name: 'author' },
        },
        category: { id: 1, name: 'test-category' },
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stockQuantity: 1,
        rating: 5,
        imageUrl: 'testbook-image-url',
      };

      mockPrismaService.book.findMany.mockResolvedValueOnce([book]);

      const result = await service.search('test-category');

      expect(result).toEqual([
        new BookDTO(
          mockBookId,
          'The Test Book',
          'Test book description.',
          '9780743273565',
          { name: 'test author user' },
          new CategoryDTO(1, 'test-category'),
          1,
          5,
          'testbook-image-url',
        ),
      ]);
    });

    it('should return an empty array when no books match the search query', async () => {
      mockPrismaService.book.findMany.mockResolvedValueOnce([]);
      const result = await service.search('nonexistent book');

      expect(result).toEqual([]);
    });

    it('should throw CustomAPIError when an error occurs', async () => {
      mockPrismaService.book.findMany.mockRejectedValueOnce(new Error('Error'));
      try {
        await service.search('search something');
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Search for the book(s) failed.');
      }
    });
  });

  describe('filter', () => {
    it('should return filtered books by price, rating, and stock availability', async () => {
      const filterParams = {
        minPrice: 10,
        maxPrice: 100,
        rating: 4,
        stock: true,
        orderBy: 'asc' as SortType,
      };

      const books = [
        {
          id: mockBookId,
          title: 'Book One',
          author: {
            id: mockUserId,
            name: 'author one',
            email: 'author1@email.com',
            role: { name: 'author' },
          },
          category: { id: 1, name: 'category one' },
          isbn: '0123456789',
          price: 11,
          description: 'Description of book one',
          stockQuantity: 10,
          rating: 4.1,
          imageUrl: 'book-one.image.url',
        },
        {
          id: mockBookId2,
          title: 'Book Two',
          author: {
            id: mockUserId,
            name: 'author one',
            email: 'author1@email.com',
            role: { name: 'author' },
          },
          category: { id: 2, name: 'category two' },
          isbn: '0987654321',
          price: 11,
          description: 'Description of book two',
          stockQuantity: 20,
          rating: 5,
          imageUrl: 'book-two.image.url',
        },
        {
          id: mockBookId3,
          title: 'Book Three',
          author: {
            id: mockUserId,
            name: 'author one',
            email: 'author1@email.com',
            role: { name: 'author' },
          },
          category: { id: 3, name: 'category three' },
          isbn: '0123456789',
          price: 99,
          description: 'Description of book three',
          stockQuantity: 30,
          rating: 4.5,
          imageUrl: 'book-three.image.url',
        },
      ];

      mockPrismaService.book.findMany.mockResolvedValueOnce(books);

      const result = await service.filter(filterParams);
      expect(result).toEqual([
        new BookDTO(
          mockBookId,
          'Book One',
          'Description of book one',
          '0123456789',
          { name: 'author one' },
          new CategoryDTO(1, 'category one'),
          11,
          4.1,
          'book-one.image.url',
        ),
        new BookDTO(
          mockBookId2,
          'Book Two',
          'Description of book two',
          '0987654321',
          { name: 'author one' },
          new CategoryDTO(2, 'category two'),
          11,
          5,
          'book-two.image.url',
        ),
        new BookDTO(
          mockBookId3,
          'Book Three',
          'Description of book three',
          '0123456789',
          { name: 'author one' },
          new CategoryDTO(3, 'category three'),
          99,
          4.5,
          'book-three.image.url',
        ),
      ]);
      expect(mockPrismaService.book.findMany).toHaveBeenCalledWith({
        where: {
          price: { gte: 10, lte: 100 },
          rating: { gte: 4 },
          stockQuantity: { gt: 0 },
        },
        select: {
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
        },
        orderBy: [{ price: 'asc' }, { rating: 'asc' }],
      });
    });
    it('should only return books that are in stock', async () => {
      const filterParams = {
        stock: true,
        orderBy: 'asc' as SortType,
      };

      const books = [
        {
          id: mockBookId,
          title: 'Book One',
          author: {
            id: mockUserId,
            name: 'author one',
            email: 'author1@email.com',
            role: { name: 'author' },
          },
          category: { id: 1, name: 'category one' },
          isbn: '0123456789',
          price: 11,
          description: 'Description of book one',
          stockQuantity: 4,
          rating: 4.1,
          imageUrl: 'book-one.image.url',
        },
      ];

      mockPrismaService.book.findMany.mockResolvedValueOnce(books);

      const result = await service.filter(filterParams);
      expect(result).toEqual([
        new BookDTO(
          mockBookId,
          'Book One',
          'Description of book one',
          '0123456789',
          { name: 'author one' },
          new CategoryDTO(1, 'category one'),
          11,
          4.1,
          'book-one.image.url',
        ),
      ]);
      expect(mockPrismaService.book.findMany).toHaveBeenCalledWith({
        where: {
          price: {},
          rating: {},
          stockQuantity: { gt: 0 },
        },
        select: expect.any(Object),
        orderBy: [{ price: 'asc' }, { rating: 'asc' }],
      });
    });
    it('should only return books that are out of stock in desc order', async () => {
      const filterParams = {
        stock: false,
        orderBy: 'desc' as SortType,
      };

      const books = [
        {
          id: mockBookId5,
          title: 'Book Five',
          author: {
            id: mockUserId,
            name: 'author one',
            email: 'author1@email.com',
            role: { name: 'author' },
          },
          category: { id: 5, name: 'category five' },
          isbn: '0123456789',
          price: 99,
          description: 'Description of book five',
          stockQuantity: 0,
          rating: 4.5,
          imageUrl: 'book-five.image.url',
        },
        {
          id: mockBookId7,
          title: 'Book Seven',
          author: {
            id: mockUserId,
            name: 'author one',
            email: 'author1@email.com',
            role: { name: 'author' },
          },
          category: { id: 7, name: 'category seven' },
          isbn: '0987654321',
          price: 11,
          description: 'Description of book seven',
          stockQuantity: 0,
          rating: 5,
          imageUrl: 'book-seven.image.url',
        },
        {
          id: mockBookId6,
          title: 'Book Six',
          author: {
            id: mockUserId,
            name: 'author one',
            email: 'author1@email.com',
            role: { name: 'author' },
          },
          category: { id: 6, name: 'category six' },
          isbn: '0123456789',
          price: 11,
          description: 'Description of book six',
          stockQuantity: 0,
          rating: 4.1,
          imageUrl: 'book-six.image.url',
        },
      ];

      mockPrismaService.book.findMany.mockResolvedValueOnce(books);

      const result = await service.filter(filterParams);
      expect(result).toEqual([
        new BookDTO(
          mockBookId5,
          'Book Five',
          'Description of book five',
          '0123456789',
          { name: 'author one' },
          new CategoryDTO(5, 'category five'),
          99,
          4.5,
          'book-five.image.url',
        ),
        new BookDTO(
          mockBookId7,
          'Book Seven',
          'Description of book seven',
          '0987654321',
          { name: 'author one' },
          new CategoryDTO(7, 'category seven'),
          11,
          5,
          'book-seven.image.url',
        ),
        new BookDTO(
          mockBookId6,
          'Book Six',
          'Description of book six',
          '0123456789',
          { name: 'author one' },
          new CategoryDTO(6, 'category six'),
          11,
          4.1,
          'book-six.image.url',
        ),
      ]);
      expect(mockPrismaService.book.findMany).toHaveBeenCalledWith({
        where: {
          price: {},
          rating: {},
          stockQuantity: { equals: 0 },
        },
        select: expect.any(Object),
        orderBy: [{ price: 'desc' }, { rating: 'desc' }],
      });
    });
    it('should return books filtered by min and max price', async () => {
      const filterParams = {
        minPrice: 20,
        maxPrice: 50,
        orderBy: 'asc' as SortType,
      };

      const books = [
        {
          id: mockBookId,
          title: 'Book One',
          author: {
            id: mockUserId,
            name: 'author one',
            email: 'author1@email.com',
            role: { name: 'author' },
          },
          category: { id: 1, name: 'category one' },
          isbn: '0123456789',
          price: 35,
          description: 'Description of book one',
          stockQuantity: 10,
          rating: 4.1,
          imageUrl: 'book-one.image.url',
        },

        {
          id: mockBookId2,
          title: 'Book Two',
          author: {
            id: mockUserId,
            name: 'author two',
            email: 'author2@email.com',
            role: { name: 'author' },
          },
          category: { id: 2, name: 'category two' },
          isbn: '0123456789',
          price: 35,
          description: 'Description of book two',
          stockQuantity: 0,
          rating: 4.1,
          imageUrl: 'book-two.image.url',
        },
      ];

      mockPrismaService.book.findMany.mockResolvedValueOnce(books);

      const result = await service.filter(filterParams);
      expect(result).toEqual([
        new BookDTO(
          mockBookId,
          'Book One',
          'Description of book one',
          '0123456789',
          { name: 'author one' },
          new CategoryDTO(1, 'category one'),
          35,
          4.1,
          'book-one.image.url',
        ),

        new BookDTO(
          mockBookId2,
          'Book Two',
          'Description of book two',
          '0123456789',
          { name: 'author two' },
          new CategoryDTO(2, 'category two'),
          35,
          4.1,
          'book-two.image.url',
        ),
      ]);
      expect(mockPrismaService.book.findMany).toHaveBeenCalledWith({
        where: {
          price: { gte: 20, lte: 50 },
          rating: {},
          stockQuantity: {},
        },
        select: expect.any(Object),
        orderBy: [{ price: 'asc' }, { rating: 'asc' }],
      });
    });
    it('should return an empty array when no books match the filter conditions', async () => {
      const filterParams = {
        minPrice: 500,
        maxPrice: 1000,
        orderBy: 'asc' as SortType,
      };
      mockPrismaService.book.findMany.mockResolvedValue([]);

      const result = await service.filter(filterParams);

      expect(result).toEqual([]);
    });
    it('should throw CustomAPIError when an error occurs', async () => {
      const filterParams = {
        minPrice: 500,
        maxPrice: 1000,
        orderBy: 'asc' as SortType,
      };

      mockPrismaService.book.findMany.mockRejectedValueOnce(new Error('Error'));
      try {
        await service.filter(filterParams);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Filter operation for book(s) failed.');
      }
    });
  });
});
