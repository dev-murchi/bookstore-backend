/*
 * E2E Scenarios for UserController
 *
 * 1. GET /users/profile
 *    - Success: An authenticated user (Admin or User) can retrieve their own profile.
 *    - Failure (Unauthorized): A request without a valid token should be rejected.
 *
 * 2. PUT /users/profile
 *    - Success: An authenticated user can update their own profile (name, email, password).
 *    - Success (Password Change): When a user changes their password, the `loginRequired` flag should be `true`.
 *    - Failure (Incorrect Password): The request should be rejected if the provided current password is incorrect.
 *    - Failure (No Changes): The request should be rejected if no new data is provided for the update.
 *    - Failure (Unauthorized): A request without a valid token should be rejected.
 *
 * 3. GET /users
 *    - Success (Admin): An admin can retrieve a list of all users.
 *    - Failure (Non-Admin): A non-admin user should be forbidden from accessing this endpoint.
 *    - Failure (Unauthorized): A request without a valid token should be rejected.
 *
 * 4. PUT /users/:id
 *    - Success (Admin): An admin can update any user's profile by their ID.
 *    - Failure (Non-Admin): A non-admin user should be forbidden from accessing this endpoint.
 *    - Failure (User Not Found): The request should be rejected if the user ID does not exist.
 *    - Failure (Unauthorized): A request without a valid token should be rejected.
 *
 * 5. DELETE /users/:id
 *    - Success (Admin): An admin can delete a user by their ID.
 *    - Failure (Non-Admin): A non-admin user should be forbidden from accessing this endpoint.
 *    - Failure (User Not Found): The request should be rejected if the user ID does not exist.
 *    - Failure (Unauthorized): A request without a valid token should be rejected.
 *
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
import { setTimeout } from 'node:timers/promises';
import { RoleEnum } from 'src/common/enum/role.enum';
jest.setTimeout(10000);

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let dbManager: TestDBManager;
  let prismaService: PrismaService;
  let adminToken: string;
  let userToken: string;
  let adminUser: any;
  let regularUser: any;

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

    // create mock users
    const users: MockUserType[] = [
      {
        name: 'Admin User',
        email: 'admin@test.com',
        password: 'Password123!',
        role: RoleEnum.Admin,
      },
      {
        name: 'Regular User',
        email: 'user@test.com',
        password: 'Password123!',
        role: RoleEnum.User,
      },
    ];
    // seed users
    await dbManager.seedUsers(users);

    // get users from db
    adminUser = await prismaService.user.findUnique({
      where: { email: 'admin@test.com' },
    });
    regularUser = await prismaService.user.findUnique({
      where: { email: 'user@test.com' },
    });

    // login users to get tokens
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'Password123!' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'Password123!' })
      .expect(200);
    userToken = userLogin.body.accessToken;
  });

  afterEach(async () => {
    await setTimeout(500);
  });

  afterAll(async () => {
    await app.close();
    await dbManager.teardown();
  });

  describe('GET /users/profile', () => {
    it('should return the profile of the authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.email).toBe('user@test.com');
      expect(res.body.role).toBe('user');
    });
    it('should return 401 for unauthenticated users', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/profile')
        .expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'User is not authenticated or authorized.',
      });
    });
  });

  describe('PUT /users/profile', () => {
    it('should update the profile of the authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated User', password: 'Password123!' })
        .expect(200);

      expect(res.body.data.name).toBe('Updated User');

      const updatedUserInDb = await prismaService.user.findUnique({ where: { id: regularUser.id } });
      expect(updatedUserInDb.name).toBe('Updated User');
    });

    it('should require re-login after password change', async () => {
      const res = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ newPassword: 'NewPassword123!', password: 'Password123!' })
        .expect(200);

      expect(res.body.loginRequired).toBe(true);
    });

    it('should return 400 for incorrect current password', async () => {
      const res = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Another Update', password: 'WrongPassword123!' })
        .expect(400);
      expect(res.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid user credentials',
      });
    });

    it('should return 400 if no update data is provided', async () => {
      const res = await request(app.getHttpServer())
        .put('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ password: 'Password123!' })
        .expect(400);
      expect(res.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'No changes provided.',
      });
    });

    it('should return 401 for unauthenticated users', async () => {
      const res = await request(app.getHttpServer())
        .put('/users/profile')
        .send({ name: 'Unauthorized Update' })
        .expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'User is not authenticated or authorized.',
      });
    });
  });

  describe('GET /users', () => {
    it('should return a list of all users for an admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body).toEqual({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied. Insufficient permissions.',
      });
    });

    it('should return 401 for unauthenticated users', async () => {
      const res = await request(app.getHttpServer()).get('/users').expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'User is not authenticated or authorized.',
      });
    });
  });

  describe('PUT /users/:id', () => {
    it('should allow an admin to update any user by ID', async () => {
      const res = await request(app.getHttpServer())
        .put(`/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Updated User' })
        .expect(200);

      expect(res.body.name).toBe('Admin Updated User');

      const updatedUserInDb = await prismaService.user.findUnique({ where: { id: regularUser.id } });
      expect(updatedUserInDb.name).toBe('Admin Updated User');
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app.getHttpServer())
        .put(`/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'User Tries to Update Admin' })
        .expect(403);

      expect(res.body).toEqual({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied. Insufficient permissions.',
      });
    });

    it('should return 500 for a non-existent user ID', async () => {
      const nonExistentId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const res = await request(app.getHttpServer())
        .put(`/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Update Non Existent' })
        .expect(500);

      expect(res.body).toEqual({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'User update failed.',
      });
    });

    it('should return 401 for unauthenticated users', async () => {
      const res = await request(app.getHttpServer())
        .put(`/users/${regularUser.id}`)
        .send({ name: 'Unauthorized Update' })
        .expect(401);

      expect(res.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'User is not authenticated or authorized.',
      });
    });
  });

  describe('DELETE /users/:id', () => {
    it('should allow an admin to delete a user by ID', async () => {
      const newUser = await prismaService.user.create({
        data: {
          name: 'To Be Deleted',
          email: 'deleteme@test.com',
          password: 'Password123!',
          roleId: regularUser.roleId,
          lastPasswordResetAt: new Date(),
        },
      });

      await request(app.getHttpServer())
        .delete(`/users/${newUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const deletedUserInDb = await prismaService.user.findUnique({ where: { id: newUser.id } });
      expect(deletedUserInDb).toBeNull();
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body).toEqual({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Access denied. Insufficient permissions.',
      });
    });

    it('should return 500 for a non-existent user ID', async () => {
      const nonExistentId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const res = await request(app.getHttpServer())
        .delete(`/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);

      expect(res.body).toEqual({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'User could not be deleted.',
      });
    });

    it('should return 401 for unauthenticated users', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/users/${regularUser.id}`)
        .expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'User is not authenticated or authorized.',
      });
    });
  });
});
