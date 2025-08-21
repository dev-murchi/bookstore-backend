/*
 * E2E Scenarios for BooksController
 *
 * 1. POST /books
 *    - Success (Admin): An admin can create a book for any author.
 *    - Success (Author): An author can create a book for themselves.
 *    - Failure (Author Mismatch): An author cannot create a book for another author.
 *    - Failure (Non-Author/Admin): A regular user cannot create a book.
 *    - Failure (Guest User): A request without a valid token should be rejected.
 *    - Failure (Invalid Data): The request should be rejected if the book data is invalid (e.g., missing title, price).
 *
 * 2. GET /books
 *    - Success: Anyone (authenticated or not) can retrieve a list of all books.
 *
 * 3. GET /books/search
 *    - Success: Anyone can search for books by a keyword.
 *    - Failure (Query Too Short): The request should be rejected if the search query is less than 3 characters.
 *
 * 4. GET /books/filter
 *    - Success: Anyone can filter books by price, rating, stock, and sort order.
 *    - Failure (Invalid Filter): The request should be rejected if the filter parameters are invalid.
 *
 * 5. GET /books/:id
 *    - Success: Anyone can retrieve a single book by its ID.
 *    - Failure (Not Found): The request should be rejected if the book ID does not exist.
 *
 * 6. PATCH /books/:id
 *    - Success (Admin): An admin can update any book.
 *    - Success (Author): An author can update their own book.
 *    - Failure (Author Mismatch): An author cannot update another author's book.
 *    - Failure (Non-Author/Admin): A regular user cannot update a book.
 *    - Failure (Guest User): A request without a valid token should be rejected.
 *    - Failure (Not Found): The request should be rejected if the book ID does not exist.
 *
 * 7. POST /books/:id/reviews
 *    - Success (User): An authenticated user can submit a review for a book.
 *    - Failure (Non-User): An admin or author should not be able to submit a review.
 *    - Failure (Guest User): A request without a valid token should be rejected.
 *    - Failure (Invalid Data): The request should be rejected if the review data is invalid (e.g., missing rating).
 *    - Failure (Not Found): The request should be rejected if the book ID does not exist.
 *
 * 8. GET /books/:id/reviews
 *    - Success: Anyone can retrieve the reviews for a specific book.
 *    - Failure (Not Found): The request should be rejected if the book ID does not exist.
 */

/*
 * E2E Scenarios for BooksController
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { MockUserType, TestDBManager } from './test-db-manager';
import { PrismaService } from 'src/prisma/prisma.service';
import { StripeService } from 'src/payment/stripe/stripe.service';
import { MockStripeService } from './mocks/services/mock-stripe.service';
import { NodemailerService } from 'src/mail/nodemailer/nodemailer.service';
import { MockNodemailerService } from './mocks/services/mock-nodemailer.service';
import { RoleEnum } from 'src/common/enum/role.enum';
import { setTimeout } from 'node:timers/promises';

jest.setTimeout(10000);

// users
const admin: MockUserType = {
  email: 'admin@test.com',
  name: 'Admin User',
  role: RoleEnum.Admin,
  password: 'StrongP@ssword.123',
};
const author1: MockUserType = {
  email: 'jrr.tolkien@test.com',
  name: 'J.R.R. Tolkien',
  role: RoleEnum.Author,
  password: 'StrongP@ssword.123',
};
const author2: MockUserType = {
  email: 'leotolstoy@test.com',
  name: 'Leo Tolstoy',
  role: RoleEnum.Author,
  password: 'StrongP@ssword.123',
};
const user: MockUserType = {
  email: 'user@test.com',
  name: 'Regular User',
  role: RoleEnum.User,
  password: 'StrongP@ssword.123',
};

// categories
const category1: any = { name: 'Fantasy' };
const category2: any = { name: 'Dystopian' };

const book1 = {
  title: 'The Hobbit',
  categoryId: 2,
  isbn: '9780547928227',
  price: 14.99,
  stockQuantity: 25,
  isActive: true,
  author: {
    name: author1.name,
    email: author1.email,
  },
  description: "Bilbo's unexpected journey begins.",
  imageUrl: 'https://example.com/the-hobbit.jpg',
};
const book2 = {
  title: 'War and Peace',
  categoryId: 1,
  isbn: '9780679783457',
  price: 13.99,
  stockQuantity: 18,
  isActive: true,
  author: {
    name: author2.name,
    email: author2.email,
  },
  description: 'An epic historical novel.',
  imageUrl: 'https://example.com/war-and-peace.jpg',
};

const book3 = {
  title: 'The Two Towers',
  categoryId: 1,
  isbn: '9780547928203',
  price: 15,
  stockQuantity: 7,
  isActive: true,
  author: {
    name: author1.name,
    email: author1.email,
  },
  description: 'Admin created book',
  imageUrl: 'https://example.com/two-towers.png',
};

const book4 = {
  title: 'Author1 New Book',
  categoryId: 1,
  isbn: '9781601234568',
  price: 12,
  stockQuantity: 8,
  isActive: true,
  author: { name: author1.name, email: author1.email },
  description: 'author1 created book',
  imageUrl: 'https://example.com/author1-book.png',
};

// book data for seeding and testing
const bookDataForAuthor1 = {
  ...book1,
  author: book1.author.email,
};

const bookDataForAuthor2 = {
  ...book2,
  author: book2.author.email,
};

const newBookByAdmin = {
  ...book3,
  author: book3.author.email,
};

const newBookByAuthor1 = {
  ...book4,
  author: book4.author.email,
};

describe('BooksController (e2e)', () => {
  let app: INestApplication;
  let dbManager: TestDBManager;
  let prismaService: PrismaService;

  let adminToken: string;
  let author1Token: string;
  let userToken: string;

  let bookOwnedByAuthor1: any;
  let bookOwnedByAuthor2: any;

  // Helper function to get JWT tokens
  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return res.body.accessToken;
  }

  beforeAll(async () => {
    dbManager = new TestDBManager(process.env.DATABASE_URL);
    prismaService = await dbManager.setup();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .overrideProvider(StripeService)
      .useClass(MockStripeService)
      .overrideProvider(NodemailerService)
      .useClass(MockNodemailerService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    await dbManager.seedUsers([admin, author1, user, author2]);
    await dbManager.seedCategories([category1, category2]);

    await dbManager.seedBooks([
      {
        title: bookDataForAuthor1.title,
        isbn: bookDataForAuthor1.isbn,
        price: bookDataForAuthor1.price,
        stockQuantity: bookDataForAuthor1.stockQuantity,
        isActive: bookDataForAuthor1.isActive,
        description: bookDataForAuthor1.description,
        imageUrl: bookDataForAuthor1.imageUrl,
        categoryId: bookDataForAuthor1.categoryId,
        author: bookDataForAuthor1.author,
      },
      {
        title: bookDataForAuthor2.title,
        isbn: bookDataForAuthor2.isbn,
        price: bookDataForAuthor2.price,
        stockQuantity: bookDataForAuthor2.stockQuantity,
        isActive: bookDataForAuthor2.isActive,
        description: bookDataForAuthor2.description,
        imageUrl: bookDataForAuthor2.imageUrl,
        categoryId: bookDataForAuthor2.categoryId,
        author: bookDataForAuthor2.author,
      },
    ]);

    bookOwnedByAuthor1 = await prismaService.book.findUnique({
      where: { isbn: bookDataForAuthor1.isbn },
      include: { category: true, author: true },
    });

    console.warn({ bookOwnedByAuthor1 });

    bookOwnedByAuthor2 = await prismaService.book.findUnique({
      where: { isbn: bookDataForAuthor2.isbn },
      include: { category: true, author: true },
    });

    adminToken = await login(admin.email, admin.password);
    author1Token = await login(author1.email, author1.password);
    userToken = await login(user.email, user.password);
  });

  afterEach(async () => {
    await setTimeout(500);
  });

  afterAll(async () => {
    await app.close();
    await dbManager.teardown();
  });

  describe('POST /books (Create Book)', () => {
    it('should allow an admin to create a book for any author', async () => {
      const res = await request(app.getHttpServer())
        .post('/books')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newBookByAdmin);
      expect(res.body.message).toBeUndefined();
      expect(res.status).toBe(201);
      const expectedBook = {
        id: expect.any(String),
        title: newBookByAdmin.title,
        isbn: newBookByAdmin.isbn,
        price: Number(newBookByAdmin.price),
        author: { name: author1.name },
        description: newBookByAdmin.description,
        imageUrl: newBookByAdmin.imageUrl,
        category: { value: category1.name },
        rating: 0,
      };
      expect(res.body.data).toEqual(expectedBook);
    });

    it('should allow an author to create their own book', async () => {
      const res = await request(app.getHttpServer())
        .post('/books')
        .set('Authorization', `Bearer ${author1Token}`)
        .send(newBookByAuthor1);

      expect(res.status).toBe(201);
      const expectedBook = {
        id: expect.any(String),
        title: newBookByAuthor1.title,
        isbn: newBookByAuthor1.isbn,
        price: Number(newBookByAuthor1.price),
        author: { name: author1.name },
        description: newBookByAuthor1.description,
        imageUrl: newBookByAuthor1.imageUrl,
        category: { value: category1.name },
        rating: 0,
      };
      expect(res.body.data).toEqual(expectedBook);
    });

    it('should not allow an author to create a book for a different author', async () => {
      const res = await request(app.getHttpServer())
        .post('/books')
        .set('Authorization', `Bearer ${author1Token}`)
        .send({
          title: newBookByAuthor1.title,
          categoryId: newBookByAuthor1.categoryId,
          isbn: newBookByAuthor1.isbn,
          price: newBookByAuthor1.price,
          stockQuantity: newBookByAuthor1.stockQuantity,
          isActive: newBookByAuthor1.isActive,
          author: author2.email,
          description: newBookByAuthor1.description,
          imageUrl: newBookByAuthor1.imageUrl,
        });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        message: 'You are not authorized to perform this action.',
        error: 'Unauthorized',
        statusCode: 401,
      });
    });

    it('should not allow a regular user to create a book', async () => {
      const res = await request(app.getHttpServer())
        .post('/books')
        .set('Authorization', `Bearer ${userToken}`)
        .send(newBookByAdmin);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        message: 'Access denied. Insufficient permissions.',
        error: 'Forbidden',
        statusCode: 403,
      });
    });

    it('should not allow a guest user to create a book', async () => {
      const res = await request(app.getHttpServer())
        .post('/books')
        .send(newBookByAdmin);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        message: 'Access denied. Insufficient permissions.',
        error: 'Forbidden',
        statusCode: 403,
      });
    });

    it('should return 400 when book data is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/books')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isbn: 'invalid-isbn' });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: expect.arrayContaining([
          'title should not be empty',
          'title must be a string',
          'categoryId must be an integer number',
          'isbn must be an ISBN',
          'price must be a positive number',
          'stockQuantity must not be less than 0',
          'stockQuantity must be an integer number',
          'isActive must be a boolean value',
          'author must be an email',
        ]),
        error: 'Bad Request',
        statusCode: 400,
      });
    });
  });

  describe('GET /books (Read All Books)', () => {
    it('should return all books', async () => {
      const res = await request(app.getHttpServer()).get('/books');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(4);
    });
  });

  describe('GET /books/search (Search Books)', () => {
    it('should return books matching a search query', async () => {
      const res = await request(app.getHttpServer())
        .get('/books/search')
        .query({ search: 'Hobbit' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].title).toBe('The Hobbit');
    });

    it('should return 400 if the search query is too short', async () => {
      const res = await request(app.getHttpServer())
        .get('/books/search')
        .query({ search: 'Ho' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /books/filter (Filter Books)', () => {
    it('should return books matching filter criteria', async () => {
      const res = await request(app.getHttpServer())
        .get('/books/filter')
        .query({
          minPrice: 10,
          maxPrice: 20,
          stock: true,
          sort: 'asc',
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(
        res.body.data.some((book: any) => book.title === 'The Hobbit'),
      ).toBe(true);
    });

    it('should return 400 for invalid filter parameters', async () => {
      const res = await request(app.getHttpServer())
        .get('/books/filter')
        .query({ minPrice: -1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toEqual('minPrice can not be less than zero');

      const res2 = await request(app.getHttpServer())
        .get('/books/filter')
        .query({ minPrice: 'invalid' });

      expect(res2.status).toBe(400);
      expect(res2.body.message).toEqual('minPrice must be a number');
    });
  });

  describe('GET /books/:id (Read Single Book)', () => {
    it('should return a book by its ID', async () => {
      const res = await request(app.getHttpServer()).get(
        `/books/${bookOwnedByAuthor1.id}`,
      );

      expect(res.status).toBe(200);
      const expectedBook = {
        id: bookOwnedByAuthor1.id,
        title: bookOwnedByAuthor1.title,
        isbn: bookOwnedByAuthor1.isbn,
        price: Number(bookOwnedByAuthor1.price),
        rating: bookOwnedByAuthor1.rating,
        imageUrl: bookOwnedByAuthor1.imageUrl,
        description: bookOwnedByAuthor1.description,
        category: { value: bookOwnedByAuthor1.category.name },
        author: { name: bookOwnedByAuthor1.author.name },
      };
      expect(res.body.data).toEqual(expectedBook);
    });

    it('should return {data: null} for a non-existent ID', async () => {
      const res = await request(app.getHttpServer()).get(
        '/books/00000000-0000-0000-0000-000000000000',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: null });
    });
  });

  describe('PATCH /books/:id (Update Book)', () => {
    it('should allow an admin to update any book', async () => {
      console.warn({ bookOwnedByAuthor1_2: bookOwnedByAuthor1 });
      const res = await request(app.getHttpServer())
        .patch(`/books/${bookOwnedByAuthor1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          author: bookOwnedByAuthor1.author.email,
          title: 'The Hobbit (Revised Edition)',
        });

      expect(res.status).toBe(200);
      const expectedBook = {
        id: bookOwnedByAuthor1.id,
        title: 'The Hobbit (Revised Edition)', // updated field
        isbn: bookOwnedByAuthor1.isbn,
        price: Number(bookOwnedByAuthor1.price),
        rating: bookOwnedByAuthor1.rating,
        imageUrl: bookOwnedByAuthor1.imageUrl,
        description: bookOwnedByAuthor1.description,
        category: { value: bookOwnedByAuthor1.category.name },
        author: { name: bookOwnedByAuthor1.author.name },
      };
      expect(res.body.data).toEqual(expectedBook);
    });

    it('should allow an author to update their own book', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/books/${bookOwnedByAuthor1.id}`)
        .set('Authorization', `Bearer ${author1Token}`)
        .send({
          author: bookOwnedByAuthor1.author.email,
          title: 'The Hobbit (Author Update)',
        });

      expect(res.status).toBe(200);
      const expectedBook = {
        id: bookOwnedByAuthor1.id,
        title: 'The Hobbit (Author Update)', // updated field
        isbn: bookOwnedByAuthor1.isbn,
        price: Number(bookOwnedByAuthor1.price),
        rating: bookOwnedByAuthor1.rating,
        imageUrl: bookOwnedByAuthor1.imageUrl,
        description: bookOwnedByAuthor1.description,
        category: { value: bookOwnedByAuthor1.category.name },
        author: { name: bookOwnedByAuthor1.author.name },
      };
      expect(res.body.data).toEqual(expectedBook);
    });

    it('should not allow an author to update a book by another author', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/books/${bookOwnedByAuthor2.id}`)
        .set('Authorization', `Bearer ${author1Token}`)
        .send({
          author: bookOwnedByAuthor2.author.email,
          title: 'The Hobbit (Revised Edition)',
        });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        message: 'You are not authorized to perform this action.',
        error: 'Unauthorized',
        statusCode: 401,
      });
    });

    it('should not allow a regular user to update a book', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/books/${bookOwnedByAuthor1.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          author: bookOwnedByAuthor1.author.email,
          title: 'The Hobbit (Revised Edition)',
        });

      expect(res.status).toBe(403);
    });

    it('should not allow the guest user to update a book', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/books/${bookOwnedByAuthor1.id}`)
        .send({
          author: bookOwnedByAuthor1.author.email,
          title: 'The Hobbit (Revised Edition)',
        });

      expect(res.status).toBe(403);
    });

    it('should return 404 for a non-existent book ID', async () => {
      const res = await request(app.getHttpServer())
        .patch('/books/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          author: bookOwnedByAuthor1.author.email,
          title: 'The Hobbit (Revised Edition)',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Book informations could not be updated');
    });
  });

  describe('POST /books/:id/reviews (Create Review)', () => {
    it.todo('should allow a user to submit a review');
    it.todo('should not allow an admin to submit a review');
    it.todo('should not allow an author to submit a review');
    it.todo('should not allow the guest user to submit a review');
    it.todo('should return 400 for invalid review data');
    it.todo('should return 404 for a non-existent book ID');
  });

  describe('GET /books/:id/reviews (Read Book Reviews)', () => {
    it.todo('should return all reviews for a specific book');
    it.todo('should return 404 for a non-existent book ID');
  });
});
