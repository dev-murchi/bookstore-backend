import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserService } from 'src/user/user.service';
import { ReviewsService } from 'src/reviews/reviews.service';
import { RoleEnum } from 'src/common/enum/role.enum';
import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateBookDTO } from 'src/common/dto/create-book.dto';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { BookDTO } from 'src/common/dto/book.dto';
import { BookFilterDTO } from 'src/common/dto/book-filter.dto';

const mockBooksService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  search: jest.fn(),
  filter: jest.fn(),
};

const mockUserService = {
  findByEmail: jest.fn(),
};

const mockReviewsService = {
  createReview: jest.fn(),
  getReviewsOfBook: jest.fn(),
};

describe('BooksController', () => {
  let controller: BooksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        {
          provide: BooksService,
          useValue: mockBooksService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: ReviewsService,
          useValue: mockReviewsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        handleRequest: jest.fn(),
      })
      .compile();

    controller = module.get<BooksController>(BooksController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('validateAuthorOrThrow', () => {
    it('should throw UnauthorizedException if the requested user role is not valid', async () => {
      const requestedUser = {
        id: 'user-uuid-1',
        email: 'testuser@email.com',
        role: RoleEnum.User,
      };
      const authorEmail = 'author@email.com';
      try {
        await controller['validateAuthorOrThrow'](requestedUser, authorEmail);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe(
          'You are not authorized to perform this action.',
        );
      }
    });
    it('should throw UnauthorizedException if author email mismatch', async () => {
      const requestedUser = {
        id: 'author-uuid-1',
        email: 'author@email.com',
        role: RoleEnum.Author,
      };
      const authorEmail = 'other@email.com';
      try {
        await controller['validateAuthorOrThrow'](requestedUser, authorEmail);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe(
          'You are not authorized to perform this action.',
        );
      }
    });
    it('should validate author role and email', async () => {
      const requestedUser = {
        id: 'author-uuid-1',
        email: 'author@email.com',
        role: RoleEnum.Author,
      };
      const authorEmail = 'author@email.com';
      const result = await controller['validateAuthorOrThrow'](
        requestedUser,
        authorEmail,
      );
      expect(result).toEqual({ authorId: requestedUser.id });
    });
    it('should throw BadRequestException if author not found', async () => {
      const requestedUser = {
        id: 'admin-uuid-1',
        email: 'admin@email.com',
        role: RoleEnum.Admin,
      };
      const authorEmail = 'author@email.com';
      mockUserService.findByEmail.mockResolvedValueOnce(null);
      try {
        await controller['validateAuthorOrThrow'](requestedUser, authorEmail);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          'Please ensure the author exists before proceeding.',
        );
      }
    });
    it('should throw BadRequestException if found user is not author', async () => {
      const requestedUser = {
        id: 'admin-uuid-1',
        email: 'admin@email.com',
        role: RoleEnum.Admin,
      };
      const authorEmail = 'user@email.com';
      mockUserService.findByEmail.mockResolvedValueOnce({
        id: 'user-uuid-1',
        email: 'user@email.com',
        role: RoleEnum.User,
      });
      try {
        await controller['validateAuthorOrThrow'](requestedUser, authorEmail);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          'Books can only belong to registered authors.',
        );
      }
    });
    it('should return authorId for valid author', async () => {
      const requestedUser = {
        id: 'admin-uuid-1',
        email: 'admin@email.com',
        role: RoleEnum.Admin,
      };
      const authorEmail = 'author@email.com';
      const expectedAuthor = {
        id: 'author-uuid-1',
        email: 'autho@email.com',
        role: RoleEnum.Author,
      };
      mockUserService.findByEmail.mockResolvedValueOnce(expectedAuthor);
      const result = await controller['validateAuthorOrThrow'](
        requestedUser,
        authorEmail,
      );
      expect(result).toEqual({ authorId: expectedAuthor.id });
    });
  });

  describe('create', () => {
    const requestBody: CreateBookDTO = {
      title: 'Book Title',
      categoryId: 1,
      isbn: '978-1-60123-456-2',
      price: 10,
      stockQuantity: 10,
      isActive: true,
      author: 'author@email.com',
      description: 'book description',
      imageUrl: 'https://example-image.com/image-1.png',
    };

    const adminUser = {
      id: 'admin-uuid-1',
      email: 'admin@email.com',
      role: RoleEnum.Admin,
    };

    const authorOne = {
      id: 'author-uuid-1',
      email: 'author1@email.com',
      role: RoleEnum.Author,
    };

    const authorTwo = {
      id: 'author-uuid-2',
      email: 'author2@email.com',
      role: RoleEnum.Author,
    };

    it('should throw BadRequestException', async () => {
      const body = { ...requestBody, author: 'missingauthor@email.com' };

      const request = {
        user: { ...adminUser },
      } as any;

      mockUserService.findByEmail.mockResolvedValueOnce(null);

      try {
        await controller.create(request, body);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          'Please ensure the author exists before proceeding.',
        );
      }
    });
    it('should throw UnauthorizedException', async () => {
      const body = { ...requestBody, author: authorOne.email };
      const request = {
        user: { ...authorTwo },
      } as any;

      try {
        await controller.create(request, body);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe(
          'You are not authorized to perform this action.',
        );
      }
    });
    it('should throw BadRequestException for CustomAPIError', async () => {
      const body = { ...requestBody, author: authorOne.email };
      const request = {
        user: { ...authorOne },
      } as any;

      mockBooksService.create.mockRejectedValueOnce(
        new CustomAPIError('Book creation failed.'),
      );
      try {
        await controller.create(request, body);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Book creation failed.');
      }
    });
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      const body = { ...requestBody, author: authorOne.email };
      const request = {
        user: { ...authorOne },
      } as any;

      mockBooksService.create.mockRejectedValueOnce(
        new Error('Unknown Error.'),
      );
      try {
        await controller.create(request, body);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to create book due to an unexpected error.',
        );
      }
    });
    it('should create book for author', async () => {
      const body = { ...requestBody, author: authorOne.email };
      const request = {
        user: { ...authorOne },
      } as any;

      const expectedData: BookDTO = {
        id: 'book-uuid-1',
        title: body.title,
        description: body.description,
        isbn: body.isbn,
        author: {
          name: body.author,
        },
        category: { id: body.categoryId, value: 'category name' },
        price: body.price,
        rating: 0,
        imageUrl: body.imageUrl,
      };

      mockBooksService.create.mockResolvedValueOnce(expectedData);

      const result = await controller.create(request, body);
      expect(result).toEqual({ data: expectedData });
      expect(mockBooksService.create).toHaveBeenCalledWith(authorOne.id, body);
    });
  });

  describe('findAll', () => {
    it('should throw BadRequestException for CustomAPIError', async () => {
      mockBooksService.findAll.mockRejectedValueOnce(
        new CustomAPIError('Books could not retrieved.'),
      );
      try {
        await controller.findAll();
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Books could not retrieved.');
      }
    });
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockBooksService.findAll.mockRejectedValueOnce(
        new Error('Unknown Error.'),
      );
      try {
        await controller.findAll();
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to retrieve the books due to an unexpected error.',
        );
      }
    });
    it('should return all books', async () => {
      const book: BookDTO = {
        id: 'book-uuid-1',
        title: 'Book Title',
        description: 'book description',
        isbn: '978-1-60123-456-2',
        author: {
          name: 'author@email.com',
        },
        category: { id: 1, value: 'category name' },
        price: 10,
        rating: 0,
        imageUrl: 'https://example-image.com/image-1.png',
      };
      mockBooksService.findAll.mockResolvedValueOnce([book]);
      const result = await controller.findAll();
      expect(result).toEqual({ data: [book] });
    });
  });

  describe('search', () => {
    it('should return empty array if query is missing', async () => {
      const result = await controller.search('');
      expect(result.data).toEqual([]);
    });
    it('should throw BadRequestException if query too short', async () => {
      try {
        await controller.search('ab');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          'The query must contain at least three characters.',
        );
      }
    });
    it('should throw BadRequestException for CustomAPIError', async () => {
      mockBooksService.search.mockRejectedValue(
        new CustomAPIError('Search for the book(s) failed.'),
      );
      try {
        await controller.search('abc');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Search for the book(s) failed.');
      }
    });
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockBooksService.search.mockRejectedValue(new Error('Unknown Error.'));
      try {
        await controller.search('abc');
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to search the book due to an unexpected error.',
        );
      }
    });
    it('should return books for valid query', async () => {
      mockBooksService.search.mockResolvedValue([{ id: 'book-uuid-1' }]);
      const result = await controller.search('abc');
      expect(result).toEqual({ data: [{ id: 'book-uuid-1' }] });
    });
  });

  describe('filter', () => {
    const query: BookFilterDTO = {
      minPrice: 1,
      maxPrice: 10,
      rating: 5,
      sort: 'asc',
      stock: true,
    };
    it('should throw BadRequestException for CustomAPIError', async () => {
      mockBooksService.filter.mockRejectedValue(
        new CustomAPIError('Filter operation for book(s) failed.'),
      );
      try {
        await controller.filter(query);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Filter operation for book(s) failed.');
      }
    });
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockBooksService.filter.mockRejectedValue(new Error('Unknown Error'));
      try {
        await controller.filter(query);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to filter the books due to an unexpected error.',
        );
      }
    });
    it('should return filtered books', async () => {
      mockBooksService.filter.mockResolvedValue([{ id: 'book-uuid-1' }]);
      const result = await controller.filter(query);
      expect(result.data).toEqual([{ id: 'book-uuid-1' }]);
    });
  });

  describe('findOne', () => {
    it('should throw BadRequestException for CustomAPIError', async () => {
      mockBooksService.findOne.mockRejectedValue(
        new CustomAPIError('Book could not retrieved.'),
      );
      try {
        await controller.findOne('book-uuid-1');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Book could not retrieved.');
      }
    });
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockBooksService.findOne.mockRejectedValue(new Error('Unknown Error'));
      try {
        await controller.findOne('book-uuid-1');
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to retrieve the book due to an unexpected error',
        );
      }
    });
    it('should return book by id', async () => {
      mockBooksService.findOne.mockResolvedValue({ id: 'book-uuid-1' });
      const result = await controller.findOne('book-uuid-1');
      expect(result.data.id).toBe('book-uuid-1');
    });
  });

  describe('update', () => {
    const adminUser = {
      id: 'admin-uuid-1',
      email: 'admin@email.com',
      role: RoleEnum.Admin,
    };

    const authorOne = {
      id: 'author-uuid-1',
      email: 'author1@email.com',
      role: RoleEnum.Author,
    };

    const bookId = 'book-uuid-1';

    it('should throw BadRequestException', async () => {
      const req = { user: { ...adminUser } } as any;
      mockUserService.findByEmail.mockResolvedValueOnce(null);
      const body = { author: 'missingauthor@email.com', title: 'Book' };
      try {
        await controller.update(req, bookId, body);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          'Please ensure the author exists before proceeding.',
        );
      }
    });
    it('should throw UnauthorizedException', async () => {
      const req = { user: { ...authorOne } } as any;
      const body = { author: 'author2@email.com', title: 'Book' };
      try {
        await controller.update(req, bookId, body);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe(
          'You are not authorized to perform this action.',
        );
      }
    });
    it('should throw BadRequestException for CustomAPIError', async () => {
      const req = { user: { ...authorOne } } as any;
      const body = { author: authorOne.email, title: 'Book' };
      mockBooksService.update.mockRejectedValueOnce(
        new CustomAPIError('Book informations could not be updated'),
      );

      try {
        await controller.update(req, bookId, body);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Book informations could not be updated');
      }
    });
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      const req = { user: { ...authorOne } } as any;
      const body = { author: authorOne.email, title: 'Book' };
      mockBooksService.update.mockRejectedValueOnce(new Error('Unknown Error'));

      try {
        await controller.update(req, bookId, body);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to update book due to an unexpected error.',
        );
      }
    });
    it('should update book for author', async () => {
      const req = { user: { ...authorOne } } as any;
      const body = { author: authorOne.email, title: 'Book' };
      const expectedData = { id: bookId };
      mockBooksService.update.mockResolvedValue(expectedData);
      const result = await controller.update(req, bookId, body);
      expect(result).toEqual({ data: expectedData });
      expect(mockBooksService.update).toHaveBeenCalledWith(
        bookId,
        body,
        authorOne.id,
      );
    });
  });

  describe('createBookReview', () => {
    const req = { user: { id: 'user-uuid-1' } } as any;
    const bookId = 'book-uuid-1';
    const body = { data: 'Great book', rating: 5 };
    it('should throw BadRequestException for CustomAPIError', async () => {
      mockReviewsService.createReview.mockRejectedValue(
        new CustomAPIError('Custom Error'),
      );
      try {
        await controller.createBookReview(bookId, body, req);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Custom Error');
      }
    });
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockReviewsService.createReview.mockRejectedValue(
        new Error('Unknown Error'),
      );
      try {
        await controller.createBookReview(bookId, body, req);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          `Review creation for the Book #${bookId} failed due to an unexpected error.`,
        );
      }
    });
    it('should create review', async () => {
      mockReviewsService.createReview.mockResolvedValue({ id: 'review-id' });
      const result = await controller.createBookReview(bookId, body, req);
      expect(result.data.id).toBe('review-id');
      expect(mockReviewsService.createReview).toHaveBeenCalled();
    });
  });

  describe('findBookReviews', () => {
    const bookId = 'book-uuid-1';
    it('should throw InternalServerErrorException on error', async () => {
      mockReviewsService.getReviewsOfBook.mockRejectedValue(
        new Error('Unknown Error'),
      );
      try {
        await controller.findBookReviews(bookId, 1, 10);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Reviews could not fetched due to an unexpected error.',
        );
      }
    });
    it('should return reviews for book', async () => {
      mockReviewsService.getReviewsOfBook.mockResolvedValue({
        data: { reviews: [], rating: 5 },
        meta: {},
      });
      const result = await controller.findBookReviews(bookId, 1, 10);
      expect(result.data.data.reviews).toEqual([]);
      expect(result.data.data.rating).toBe(5);
    });
  });
});
