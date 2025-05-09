import { Test, TestingModule } from '@nestjs/testing';
import { BooksService, SortType } from './books.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { HelperService } from '../common/helper.service';

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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw an error if book ISBN is already in use', async () => {
      const isbn = '9780743273565';
      mockPrismaService.books.findUnique.mockResolvedValueOnce({
        id: 1,
      });

      const userId = 'user-1';
      const bookDto: CreateBookDto = {
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
        await service.create(userId, bookDto);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('The book with same ISBN is already exist');
        expect(prisma.books.create).toHaveBeenCalledTimes(0);
      }
    });

    it('should successfully create a book if ISBN is not taken', async () => {
      const bookDto: CreateBookDto = {
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

      const spy = jest.spyOn(HelperService, 'generateUUID');
      spy.mockReturnValueOnce('book-uuid');
      mockPrismaService.books.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.books.create.mockResolvedValueOnce({
        bookid: 'book-uuid',
        title: bookDto.title,
        author: {
          userid: 'author-id-1',
          name: 'test author',
          email: 'testauthor@email.com',
          role: { role_name: 'author' },
        },
        category: { category_name: 'category 1' },
        isbn: bookDto.isbn,
        price: bookDto.price,
        description: bookDto.description,
        stock_quantity: bookDto.stockQuantity,
        rating: 5,
        image_url: bookDto.imageUrl,
      });

      const result = await service.create('author-id-1', bookDto);

      expect(result).toEqual({
        id: 'book-uuid',
        title: 'The Test Book',
        description: 'Test book description.',
        isbn: '9780743273565',
        author: {
          name: 'test author',
        },
        category: {
          value: 'category 1',
        },
        price: 1,
        rating: 5,
        imageUrl: 'testbook-image-url',
      });
      spy.mockRestore();
    });
  });

  describe('finAll', () => {
    it('should return empty array if there is no book', async () => {
      mockPrismaService.books.findMany.mockResolvedValueOnce([]);
      expect(await service.findAll()).toEqual([]);
    });

    it('should return all books', async () => {
      const book = {
        bookid: 'book-uuid',
        title: 'The Test Book',
        author: {
          userid: 'author-id-1',
          name: 'test author',
          email: 'testauthor@email.com',
          role: { role_name: 'author' },
        },
        category: { category_name: 'test-category' },
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stock_quantity: 1,
        rating: 5,
        image_url: 'testbook-image-url',
      };
      mockPrismaService.books.findMany.mockResolvedValueOnce([book]);
      expect(await service.findAll()).toEqual([
        {
          id: 'book-uuid',
          title: 'The Test Book',
          description: 'Test book description.',
          isbn: '9780743273565',
          author: {
            name: 'test author',
          },
          category: { value: 'test-category' },
          price: 1,
          rating: 5,
          imageUrl: 'testbook-image-url',
        },
      ]);
    });
  });

  describe('findOne', () => {
    it('should return null if there is no book', async () => {
      mockPrismaService.books.findUnique.mockResolvedValueOnce(null);
      const id = 'book-id-1';
      expect(await service.findOne(id)).toBeNull();
    });
    it('should a book by id', async () => {
      const book = {
        bookid: 'book-uuid-2',
        title: 'The Test Book 2',
        author: {
          userid: 'author-id-2',
          name: 'test author 2',
          email: 'testauthor2@email.com',
          role: { role_name: 'author' },
        },
        category: { category_name: 'test-category-2' },
        isbn: '9780743273565',
        price: 2,
        description: 'Test book description.',
        stock_quantity: 2,
        rating: 4.5,
        image_url: 'testbook-image-url-2',
      };
      mockPrismaService.books.findUnique.mockResolvedValueOnce(book);
      expect(await service.findOne('book-uuid-2')).toEqual({
        id: 'book-uuid-2',
        title: 'The Test Book 2',
        description: 'Test book description.',
        isbn: '9780743273565',
        author: {
          name: 'test author 2',
        },
        category: {
          value: 'test-category-2',
        },
        price: 2,
        rating: 4.5,
        imageUrl: 'testbook-image-url-2',
      });
    });
  });

  describe('update', () => {
    it('should throw an error when no fields are provided for update', async () => {
      const updateBookDto: UpdateBookDto = {
        author: 'testauthor@email.com',
      };
      const authorId = 'author-1';
      try {
        await service.update('book-id-1', updateBookDto, authorId);
      } catch (error) {
        expect(error).toEqual(new CustomAPIError('No changes provided.'));
        expect(prisma.books.update).toHaveBeenCalledTimes(0);
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

      const bookId = 'book-id-1';
      const authorId = 'author-1';

      mockPrismaService.books.update.mockResolvedValueOnce({
        bookid: 'book-uuid',
        title: 'Updated Book Title',
        author: {
          userid: 'author-id-1',
          name: 'test author',
          email: 'testauthor@email.com',
          role: { role_name: 'author' },
        },
        category: { category_name: 'test-category' },
        isbn: '1234567890123',
        price: 20,
        description: 'Updated description.',
        stock_quantity: 10,
        rating: 5,
        image_url: 'testbook-image-url',
      });
      const result = await service.update(bookId, updateBookDto, authorId);

      expect(result).toEqual({
        id: 'book-uuid',
        title: 'Updated Book Title',
        description: 'Updated description.',
        isbn: '1234567890123',
        author: {
          name: 'test author',
        },
        category: { value: 'test-category' },
        price: 20,
        rating: 5,
        imageUrl: 'testbook-image-url',
      });
      expect(prisma.books.update).toHaveBeenCalledWith({
        where: {
          bookid_authorid: {
            authorid: 'author-1',
            bookid: 'book-id-1',
          },
        },
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
        select: {
          bookid: true,
          title: true,
          author: {
            select: {
              userid: true,
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

      mockPrismaService.books.update.mockResolvedValueOnce({
        bookid: 'book-id-1',
        title: 'Updated Book Title',
        author: {
          userid: 'author-id-1',
          name: 'test author',
          email: 'testauthor@email.com',
          role: { role_name: 'author' },
        },
        category: { category_name: 'test-category' },
        isbn: '1234567890123',
        price: 10,
        description: 'Updated description.',
        stock_quantity: 50,
        rating: 5,
        image_url: 'testbook-image-url',
      });

      const result = await service.update(
        'book-id-1',
        updateBookDto,
        'author-id-1',
      );

      expect(result).toEqual({
        id: 'book-id-1',
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
      expect(prisma.books.update).toHaveBeenCalledWith({
        where: {
          bookid_authorid: {
            authorid: 'author-id-1',
            bookid: 'book-id-1',
          },
        },
        data: {
          price: updateBookDto.price,
          stock_quantity: updateBookDto.stockQuantity,
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

      const bookId = 'book-id-1';
      const authorId = 'author-1';
      mockPrismaService.books.update.mockRejectedValueOnce('Update failed.');
      try {
        await service.update(bookId, updateBookDto, authorId);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Book informations could not be updated');
      }
    });
  });

  describe('remove', () => {
    it('should throw an error if book does not exist', async () => {
      mockPrismaService.books.delete.mockRejectedValueOnce('Delete failed');
      const bookId = 'book-id-1';
      try {
        await service.remove(bookId);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Book could not be deleted');
      }
    });

    it('should successfully delete a book', async () => {
      mockPrismaService.books.delete.mockResolvedValueOnce({});
      const result = await service.remove('book-id-1');
      expect(result).toEqual({ message: 'Book deleted successfully' });
    });
  });

  describe('search', () => {
    it('should return books matching the search query in title', async () => {
      const book = {
        bookid: 'book-uuid',
        title: 'The Test Title Book',
        author: {
          userid: 'author-id-1',
          name: 'test author',
          email: 'testauthor@email.com',
          role: { role_name: 'author' },
        },
        category: { category_name: 'test-category' },
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stock_quantity: 1,
        rating: 5,
        image_url: 'testbook-image-url',
      };

      mockPrismaService.books.findMany.mockResolvedValueOnce([book]);

      const result = await service.search('title');

      expect(result).toEqual([
        {
          id: 'book-uuid',
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
      expect(prisma.books.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: 'title', mode: 'insensitive' } },
            { author: { name: { contains: 'title', mode: 'insensitive' } } },
            { isbn: { contains: 'title', mode: 'insensitive' } },
            {
              category: {
                category_name: { contains: 'title', mode: 'insensitive' },
              },
            },
          ],
        },
        select: expect.any(Object),
        orderBy: {},
      });

      expect(mockPrismaService.books.findMany).toHaveBeenCalledTimes(1);
    });

    it('should return books matching the search query in author', async () => {
      const book = {
        bookid: 'book-uuid',
        title: 'The Test Book',
        author: {
          userid: 'author-id-1',
          name: 'test author user',
          email: 'testauthor@email.com',
          role: { role_name: 'author' },
        },
        category: { category_name: 'test-category' },
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stock_quantity: 1,
        rating: 5,
        image_url: 'testbook-image-url',
      };

      mockPrismaService.books.findMany.mockResolvedValueOnce([book]);

      const result = await service.search('author');

      expect(result).toEqual([
        {
          id: 'book-uuid',
          title: 'The Test Book',
          description: 'Test book description.',
          isbn: '9780743273565',
          author: {
            name: 'test author user',
          },
          category: {
            value: 'test-category',
          },
          price: 1,
          rating: 5,
          imageUrl: 'testbook-image-url',
        },
      ]);
    });

    it('should return books matching the search query in isbn', async () => {
      const book = {
        bookid: 'book-uuid',
        title: 'The Test Book',
        author: {
          userid: 'author-id-1',
          name: 'test author user',
          email: 'testauthor@email.com',
          role: { role_name: 'author' },
        },
        category: { category_name: 'test-category' },
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stock_quantity: 1,
        rating: 5,
        image_url: 'testbook-image-url',
      };

      mockPrismaService.books.findMany.mockResolvedValueOnce([book]);

      const result = await service.search('9780743273565');

      expect(result).toEqual([
        {
          id: 'book-uuid',
          title: 'The Test Book',
          description: 'Test book description.',
          isbn: '9780743273565',
          author: {
            name: 'test author user',
          },
          category: {
            value: 'test-category',
          },
          price: 1,
          rating: 5,
          imageUrl: 'testbook-image-url',
        },
      ]);
    });

    it('should return books matching the search query in category', async () => {
      const book = {
        bookid: 'book-uuid',
        title: 'The Test Book',
        author: {
          userid: 'author-id-1',
          name: 'test author user',
          email: 'testauthor@email.com',
          role: { role_name: 'author' },
        },
        category: { category_name: 'test-category' },
        isbn: '9780743273565',
        price: 1,
        description: 'Test book description.',
        stock_quantity: 1,
        rating: 5,
        image_url: 'testbook-image-url',
      };

      mockPrismaService.books.findMany.mockResolvedValueOnce([book]);

      const result = await service.search('test-category');

      expect(result).toEqual([
        {
          id: 'book-uuid',
          title: 'The Test Book',
          description: 'Test book description.',
          isbn: '9780743273565',
          author: {
            name: 'test author user',
          },
          category: {
            value: 'test-category',
          },
          price: 1,
          rating: 5,
          imageUrl: 'testbook-image-url',
        },
      ]);
    });

    it('should return an empty array when no books match the search query', async () => {
      mockPrismaService.books.findMany.mockResolvedValueOnce([]);
      const result = await service.search('nonexistent book');

      expect(result).toEqual([]);
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
          bookid: 'book-uuid-1',
          title: 'Book One',
          author: {
            userid: 'author-id-1',
            name: 'author one',
            email: 'author1@email.com',
            role: { role_name: 'author' },
          },
          category: { category_name: 'category one' },
          isbn: '0123456789',
          price: 11,
          description: 'Description of book one',
          stock_quantity: 10,
          rating: 4.1,
          image_url: 'book-one.image.url',
        },
        {
          bookid: 'book-uuid-2',
          title: 'Book Two',
          author: {
            userid: 'author-id-1',
            name: 'author two',
            email: 'author2@email.com',
            role: { role_name: 'author' },
          },
          category: { category_name: 'category two' },
          isbn: '0987654321',
          price: 11,
          description: 'Description of book two',
          stock_quantity: 20,
          rating: 5,
          image_url: 'book-two.image.url',
        },
        {
          bookid: 'book-uuid-3',
          title: 'Book Three',
          author: {
            userid: 'author-id-1',
            name: 'author three',
            email: 'author3@email.com',
            role: { role_name: 'author' },
          },
          category: { category_name: 'category three' },
          isbn: '0123456789',
          price: 99,
          description: 'Description of book three',
          stock_quantity: 30,
          rating: 4.5,
          image_url: 'book-three.image.url',
        },
      ];

      mockPrismaService.books.findMany.mockResolvedValueOnce(books);

      const result = await service.filter(filterParams);
      expect(result).toEqual([
        {
          id: 'book-uuid-1',
          title: 'Book One',
          author: {
            name: 'author one',
          },
          category: { value: 'category one' },
          isbn: '0123456789',
          price: 11,
          description: 'Description of book one',
          rating: 4.1,
          imageUrl: 'book-one.image.url',
        },
        {
          id: 'book-uuid-2',
          title: 'Book Two',
          author: {
            name: 'author two',
          },
          category: { value: 'category two' },
          isbn: '0987654321',
          price: 11,
          description: 'Description of book two',
          rating: 5,
          imageUrl: 'book-two.image.url',
        },
        {
          id: 'book-uuid-3',
          title: 'Book Three',
          author: {
            name: 'author three',
          },
          category: { value: 'category three' },
          isbn: '0123456789',
          price: 99,
          description: 'Description of book three',
          rating: 4.5,
          imageUrl: 'book-three.image.url',
        },
      ]);
      expect(mockPrismaService.books.findMany).toHaveBeenCalledWith({
        where: {
          price: { gte: 10, lte: 100 },
          rating: { gte: 4 },
          stock_quantity: { gt: 0 },
        },
        select: {
          bookid: true,
          title: true,
          author: {
            select: {
              userid: true,
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
          bookid: 'book-uuid-1',
          title: 'Book One',
          author: {
            userid: 'author-id-1',
            name: 'author one',
            email: 'author1@email.com',
            role: { role_name: 'author' },
          },
          category: { category_name: 'category one' },
          isbn: '0123456789',
          price: 11,
          description: 'Description of book one',
          stock_quantity: 4,
          rating: 4.1,
          image_url: 'book-one.image.url',
        },
      ];

      mockPrismaService.books.findMany.mockResolvedValueOnce(books);

      const result = await service.filter(filterParams);
      expect(result).toEqual([
        {
          id: 'book-uuid-1',
          title: 'Book One',
          author: {
            name: 'author one',
          },
          category: { value: 'category one' },
          isbn: '0123456789',
          price: 11,
          description: 'Description of book one',
          rating: 4.1,
          imageUrl: 'book-one.image.url',
        },
      ]);
      expect(mockPrismaService.books.findMany).toHaveBeenCalledWith({
        where: {
          price: {},
          rating: {},
          stock_quantity: { gt: 0 },
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
          bookid: 'book-uuid-5',
          title: 'Book Five',
          author: {
            userid: 'author-id-5',
            name: 'author five',
            email: 'author5@email.com',
            role: { role_name: 'author' },
          },
          category: { category_name: 'category five' },
          isbn: '0123456789',
          price: 99,
          description: 'Description of book five',
          stock_quantity: 0,
          rating: 4.5,
          image_url: 'book-five.image.url',
        },
        {
          bookid: 'book-uuid-7',
          title: 'Book Seven',
          author: {
            userid: 'author-id-7',
            name: 'author seven',
            email: 'author7@email.com',
            role: { role_name: 'author' },
          },
          category: { category_name: 'category seven' },
          isbn: '0987654321',
          price: 11,
          description: 'Description of book seven',
          stock_quantity: 0,
          rating: 5,
          image_url: 'book-seven.image.url',
        },
        {
          bookid: 'book-uuid-6',
          title: 'Book Six',
          author: {
            userid: 'author-id-6',
            name: 'author six',
            email: 'author6@email.com',
            role: { role_name: 'author' },
          },
          category: { category_name: 'category six' },
          isbn: '0123456789',
          price: 11,
          description: 'Description of book six',
          stock_quantity: 0,
          rating: 4.1,
          image_url: 'book-six.image.url',
        },
      ];

      mockPrismaService.books.findMany.mockResolvedValueOnce(books);

      const result = await service.filter(filterParams);
      expect(result).toEqual([
        {
          id: 'book-uuid-5',
          title: 'Book Five',
          author: {
            name: 'author five',
          },
          category: { value: 'category five' },
          isbn: '0123456789',
          price: 99,
          description: 'Description of book five',
          rating: 4.5,
          imageUrl: 'book-five.image.url',
        },
        {
          id: 'book-uuid-7',
          title: 'Book Seven',
          author: {
            name: 'author seven',
          },
          category: { value: 'category seven' },
          isbn: '0987654321',
          price: 11,
          description: 'Description of book seven',
          rating: 5,
          imageUrl: 'book-seven.image.url',
        },
        {
          id: 'book-uuid-6',
          title: 'Book Six',
          author: {
            name: 'author six',
          },
          category: { value: 'category six' },
          isbn: '0123456789',
          price: 11,
          description: 'Description of book six',
          rating: 4.1,
          imageUrl: 'book-six.image.url',
        },
      ]);
      expect(mockPrismaService.books.findMany).toHaveBeenCalledWith({
        where: {
          price: {},
          rating: {},
          stock_quantity: { equals: 0 },
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
          bookid: 'book-uuid-1',
          title: 'Book One',
          author: {
            userid: 'author-id-1',
            name: 'author one',
            email: 'author1@email.com',
            role: { role_name: 'author' },
          },
          category: { category_name: 'category one' },
          isbn: '0123456789',
          price: 35,
          description: 'Description of book one',
          stock_quantity: 10,
          rating: 4.1,
          image_url: 'book-one.image.url',
        },

        {
          bookid: 'book-uuid-2',
          title: 'Book Two',
          author: {
            userid: 'author-id-1',
            name: 'author two',
            email: 'author2@email.com',
            role: { role_name: 'author' },
          },
          category: { category_name: 'category two' },
          isbn: '0123456789',
          price: 35,
          description: 'Description of book two',
          stock_quantity: 0,
          rating: 4.1,
          image_url: 'book-two.image.url',
        },
      ];

      mockPrismaService.books.findMany.mockResolvedValueOnce(books);

      const result = await service.filter(filterParams);
      expect(result).toEqual([
        {
          id: 'book-uuid-1',
          title: 'Book One',
          author: {
            name: 'author one',
          },
          category: { value: 'category one' },
          isbn: '0123456789',
          price: 35,
          description: 'Description of book one',
          rating: 4.1,
          imageUrl: 'book-one.image.url',
        },

        {
          id: 'book-uuid-2',
          title: 'Book Two',
          author: {
            name: 'author two',
          },
          category: { value: 'category two' },
          isbn: '0123456789',
          price: 35,
          description: 'Description of book two',
          rating: 4.1,
          imageUrl: 'book-two.image.url',
        },
      ]);
      expect(mockPrismaService.books.findMany).toHaveBeenCalledWith({
        where: {
          price: { gte: 20, lte: 50 },
          rating: {},
          stock_quantity: {},
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
      mockPrismaService.books.findMany.mockResolvedValue([]);

      const result = await service.filter(filterParams);

      expect(result).toEqual([]);
    });
  });
});
