/*
 * E2E Scenarios for CategoryController
 *
 * 1. GET /category
 *    - Success: Any user (including unauthenticated guests) can retrieve a list of all categories.
 *
 * 2. POST /category
 *    - Success (Admin): An admin can create a new category.
 *    - Failure (Non-Admin): A non-admin user (e.g., Author, User) should be forbidden.
 *    - Failure (Unauthorized): A request without a valid token should be rejected.
 *    - Failure (Duplicate Name): The request should be rejected if a category with the same name already exists.
 *    - Failure (Invalid Data): The request should be rejected if the request body is invalid (e.g., missing `value`).
 *
 * 3. PUT /category/:id
 *    - Success (Admin): An admin can update an existing category's name.
 *    - Failure (Non-Admin): A non-admin user should be forbidden.
 *    - Failure (Unauthorized): A request without a valid token should be rejected.
 *    - Failure (Not Found): The request should be rejected if the category ID does not exist.
 *
 * 4. DELETE /category/:id
 *    - Success (Admin): An admin can delete a category by its ID.
 *    - Failure (Non-Admin): A non-admin user should be forbidden.
 *    - Failure (Unauthorized): A request without a valid token should be rejected.
 *    - Failure (Not Found): The request should be rejected if the category ID does not exist.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { MockUserType, TestDBManager } from './test-db-manager';
import { PrismaService } from 'src/prisma/prisma.service';
import { NodemailerService } from 'src/mail/nodemailer/nodemailer.service';
import { StripeService } from 'src/payment/stripe/stripe.service';
import { MockNodemailerService } from './mocks/services/mock-nodemailer.service';
import { MockStripeService } from './mocks/services/mock-stripe.service';
import { RoleEnum } from 'src/common/enum/role.enum';

jest.setTimeout(10000);

describe('CategoryController (e2e)', () => {
  let app: INestApplication;
  let dbManager: TestDBManager;
  let prismaService: PrismaService;
  let adminToken: string;
  let userToken: string;
  let category: any;

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

    // Create mock users and categories
    const users: MockUserType[] = [
      { name: 'Admin Category', email: 'admincat@test.com', password: 'Password123!', role: RoleEnum.Admin },
      { name: 'User Category', email: 'usercat@test.com', password: 'Password123!', role: RoleEnum.User },
    ];
    await dbManager.seedUsers(users);

    const categories = [{ name: 'E2ECategoryTest' }];
    await dbManager.seedCategories(categories);
    category = await prismaService.category.findUnique({ where: { name: 'E2ECategoryTest' } });

    // Login users
    const adminLogin = await request(app.getHttpServer()).post('/auth/login').send({ email: 'admincat@test.com', password: 'Password123!' });
    adminToken = adminLogin.body.accessToken;

    const userLogin = await request(app.getHttpServer()).post('/auth/login').send({ email: 'usercat@test.com', password: 'Password123!' });
    userToken = userLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await dbManager.teardown();
  });

  describe('GET /category', () => {
    it('should return a list of all categories for any user', async () => {
      const res = await request(app.getHttpServer())
        .get('/category')
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('POST /category', () => {
    it('should allow an admin to create a new category', async () => {
      const res = await request(app.getHttpServer())
        .post('/category')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'New Category' })
        .expect(201);

      expect(res.body.value).toBe('New Category');

      const newCategoryInDb = await prismaService.category.findUnique({ where: { name: 'New Category' } });
      expect(newCategoryInDb).not.toBeNull();
    });

    it('should return 403 for non-admin users', async () => {
      await request(app.getHttpServer())
        .post('/category')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ value: 'User Category' })
        .expect(403);
    });

    it('should return 401 for unauthenticated users', async () => {
      await request(app.getHttpServer())
        .post('/category')
        .send({ value: 'Guest Category' })
        .expect(401);
    });

    it('should return 400 for a duplicate category name', async () => {
      const res = await request(app.getHttpServer())
        .post('/category')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'E2ECategoryTest' })
        .expect(400);

      expect(res.body.message).toBe('Category is already exist.');
    });

    it('should return 400 for invalid data', async () => {
      await request(app.getHttpServer())
        .post('/category')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('PUT /category/:id', () => {
    it('should allow an admin to update a category', async () => {
      const res = await request(app.getHttpServer())
        .put(`/category/${category.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'Updated Category' })
        .expect(200);

      expect(res.body.value).toBe('Updated Category');

      const updatedCategoryInDb = await prismaService.category.findUnique({ where: { id: category.id } });
      expect(updatedCategoryInDb.name).toBe('Updated Category');
    });

    it('should return 403 for non-admin users', async () => {
      await request(app.getHttpServer())
        .put(`/category/${category.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ value: 'User Update' })
        .expect(403);
    });

    it('should return 401 for unauthenticated users', async () => {
      await request(app.getHttpServer())
        .put(`/category/${category.id}`)
        .send({ value: 'Guest Update' })
        .expect(401);
    });

    it('should return 500 for a non-existent category ID', async () => {
      await request(app.getHttpServer())
        .put('/category/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 'Update Non-existent' })
        .expect(500);
    });
  });

  describe('DELETE /category/:id', () => {
    it('should allow an admin to delete a category', async () => {
      const newCategory = await prismaService.category.create({ data: { name: 'To Delete' } });
      await request(app.getHttpServer())
        .delete(`/category/${newCategory.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const deletedCategoryInDb = await prismaService.category.findUnique({ where: { id: newCategory.id } });
      expect(deletedCategoryInDb).toBeNull();
    });

    it('should return 403 for non-admin users', async () => {
      await request(app.getHttpServer())
        .delete(`/category/${category.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 for unauthenticated users', async () => {
      await request(app.getHttpServer())
        .delete(`/category/${category.id}`)
        .expect(401);
    });

    it('should return 500 for a non-existent category ID', async () => {
      await request(app.getHttpServer())
        .delete('/category/9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);
    });
  });
});
