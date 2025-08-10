/*
 * E2E Scenarios for AuthController
 *
 * 1. POST /auth/register
 *    - Success: A new user can register with a valid email and strong password.
 *    - Failure (Duplicate Email): Rejects registration with an existing email.
 *    - Failure (Weak Password): Rejects registration with a weak password.
 *    - Failure (Invalid Input): Handles malformed or missing input data.
 *
 * 2. POST /auth/login
 *    - Success: A registered user can log in with correct credentials.
 *    - Failure (Invalid Credentials): Rejects login with incorrect email or password.
 *
 * 3. POST /auth/create-author
 *    - Success (Admin): An admin can create a new user with the "Author" role.
 *    - Failure (Non-Admin): A non-admin user is forbidden from creating an author.
 *    - Failure (Unauthorized): Rejects request without a valid token.
 *
 * 4. POST /auth/forgot-password
 *    - Success: Initiates the password reset process for a registered email.
 *    - Graceful Handle: Handles requests for non-existent emails without revealing user existence.
 *
 * 5. POST /auth/reset-password
 *    - Success: A user can reset their password with a valid token.
 *    - Failure (Invalid Token): Rejects reset attempts with an invalid or expired token.
 *    - Failure (Weak Password): Enforces strong password requirements during reset.
 *
 * 6. DELETE /auth/logout
 *    - Success: An authenticated user can log out, invalidating their session.
 *    - Failure (Unauthorized): Rejects request without a valid token.
 *
 * 7. POST /auth/refresh
 *    - Success: A user can obtain a new access token with a valid refresh token.
 *    - Failure (Invalid Refresh Token): Rejects refresh attempts with an invalid or expired refresh token.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { TestDBManager } from './test-db-manager';
import { PrismaService } from 'src/prisma/prisma.service';
import { seedUsers } from './mocks';
import { HelperService } from 'src/common/helper.service';
import { JwtService } from '@nestjs/jwt';
import { setTimeout } from 'node:timers/promises';
import { StripeService } from 'src/payment/stripe/stripe.service';
import { MockStripeService } from './mocks/services/mock-stripe.service';
import { NodemailerService } from 'src/mail/nodemailer/nodemailer.service';
import { MockNodemailerService } from './mocks/services/mock-nodemailer.service';

jest.setTimeout(5000);

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let dbManager: TestDBManager;
  let prismaService: PrismaService;

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

    try {
      await seedUsers(prismaService);
    } catch (error) {
      process.exit(1);
    }
  });

  afterEach(async () => {
    await setTimeout(500);
  });

  afterAll(async () => {
    await dbManager.teardown();
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user with a valid email and strong password', async () => {
      const newUser = {
        name: 'new user',
        email: 'newuser@email.com',
        password: 'NewUserPassword.123',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(newUser)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toEqual(newUser.email);
      expect(res.body.name).toEqual(newUser.name);
      expect(res.body.role).toEqual('user');

      const userInDb = await prismaService.user.findUnique({
        where: { email: newUser.email },
        include: { role: true },
      });

      expect(userInDb).not.toBeNull();
      expect(userInDb.name).toEqual(newUser.name);
      expect(userInDb.email).toEqual(newUser.email);
      expect(userInDb.role.name).toEqual('user');
      expect(userInDb.isActive).toBe(true);
      expect(userInDb.lastPasswordResetAt).not.toBeNull();
    });

    it('should reject registration with an existing email', async () => {
      const existingUser = {
        name: 'test user',
        email: 'testuser@email.com',
        password: 'TestPassword.123',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(existingUser)
        .expect(400);

      expect(res.body.message).toContain('Email already in use');
    });

    it('should reject registration with a weak password', async () => {
      const weakPasswordUser = {
        name: 'weak password user',
        email: 'weakpassword@email.com',
        password: 'weak',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(res.body.message).toBeInstanceOf(Array);
      expect(res.body.message).toContain('password is not strong enough');
    });

    it('should handle malformed or missing input data', async () => {
      const malformedUser = {
        email: 'malformed@email.com',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(malformedUser)
        .expect(400);

      expect(res.body.message).toBeInstanceOf(Array);
      expect(res.body.message).toContain('password is not strong enough');
      expect(res.body.message).toContain('password should not be empty');
      expect(res.body.message).toContain('name should not be empty');
      expect(res.body.message).toContain('name must be a string');
    });
  });

  describe('POST /auth/login', () => {
    it('should log in a registered user with correct credentials', async () => {
      const credentials = {
        email: 'testuser@email.com',
        password: 'TestPassword.123',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials)
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should reject login with incorrect credentials', async () => {
      const credentials = {
        email: 'testuser@email.com',
        password: 'WrongP@ssword.123',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials)
        .expect(401);

      expect(res.body.message).toContain('Invalid user credentials');
    });
  });

  describe('POST /auth/create-author', () => {
    it('should allow an admin to create a new author', async () => {
      const adminCredentials = {
        email: 'testadmin@email.com',
        password: 'TestPassword.123',
      };
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(adminCredentials);

      const newAuthor = {
        name: 'new author',
        email: 'newauthor@email.com',
        password: 'NewAuthorPassword.123',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/create-author')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send(newAuthor)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toEqual(newAuthor.email);
      expect(res.body.name).toEqual(newAuthor.name);
      expect(res.body.role).toEqual('author');

      const authorInDb = await prismaService.user.findUnique({
        where: { email: newAuthor.email },
        include: { role: true },
      });

      expect(authorInDb).not.toBeNull();
      expect(authorInDb.role.name).toEqual('author');
      expect(authorInDb.isActive).toBe(true);
    });

    it('should forbid a non-admin user from creating an author', async () => {
      const userCredentials = {
        email: 'testuser@email.com',
        password: 'TestPassword.123',
      };
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userCredentials);

      const newAuthor = {
        name: 'new author by user',
        email: 'newauthorbyuser@email.com',
        password: 'NewAuthorPassword.123',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/create-author')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send(newAuthor)
        .expect(403);

      expect(res.body.message).toContain(
        'Access denied. Insufficient permissions.',
      );
    });

    it('should reject the request without a valid token', async () => {
      const newAuthor = {
        name: 'new author no token',
        email: 'newauthornotoken@email.com',
        password: 'NewAuthorPassword.123',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/create-author')
        .send(newAuthor)
        .expect(403);

      expect(res.body.message).toContain(
        'Access denied. Insufficient permissions.',
      );
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('should initiate the password reset process for a registered email', async () => {
      const email = { email: 'testuser@email.com' };

      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send(email)
        .expect(200);

      expect(res.body.message).toContain(
        'Please check your email for reset password link.',
      );
    });

    it('should handle requests for non-existent emails gracefully', async () => {
      const email = { email: 'nonexistent@email.com' };

      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send(email)
        .expect(200);

      expect(res.body.message).toContain(
        'Please check your email for reset password link.',
      );
    });
  });

  describe('POST /auth/reset-password', () => {
    let resetToken: string;

    beforeEach(async () => {
      const user = await prismaService.user.findUnique({
        where: { email: 'resetuser@email.com' },
      });
      const disposableToken = HelperService.generateUUID();
      const token = await prismaService.passwordResetToken.create({
        data: {
          userId: user.id,
          token: disposableToken,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });
      resetToken = token.token;
    });

    it('should allow a user to reset their password with a valid token', async () => {
      const resetData = {
        email: 'resetuser@email.com',
        token: resetToken,
        newPassword: 'NewStrongPassword.123',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send(resetData)
        .expect(200);

      expect(res.body.message).toContain(
        'Password has been reset successfully.',
      );

      const tokenInDb = await prismaService.passwordResetToken.findUnique({
        where: { token: resetToken },
      });
      expect(tokenInDb).toBeNull();
    });

    it('should reject reset attempts with an invalid token', async () => {
      const resetData = {
        email: 'resetuser@email.com',
        token: 'invalid-token',
        newPassword: 'NewStrongPassword.123',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send(resetData)
        .expect(400);

      expect(res.body.message).toContain('Invalid token');
    });

    it('should enforce strong password requirements during reset', async () => {
      const resetData = {
        email: 'resetuser@email.com',
        token: resetToken,
        newPassword: 'weak',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send(resetData)
        .expect(400);

      expect(res.body.message).toBeInstanceOf(Array);
      expect(res.body.message).toContain('newPassword is not strong enough');
    });
  });

  describe('DELETE /auth/logout', () => {
    it('should log out an authenticated user', async () => {
      const credentials = {
        email: 'testuser@email.com',
        password: 'TestPassword.123',
      };
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials);

      const res = await request(app.getHttpServer())
        .delete('/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);

      expect(res.body.message).toContain('Logged out successfully');
    });

    it('should invalidate the access token upon logout', async () => {
      const credentials = {
        email: 'testuser@email.com',
        password: 'TestPassword.123',
      };
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials)
        .expect(200);

      const accessToken = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .delete('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .delete('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(res.body.message).toContain('Please login');
    });

    it('should reject the request without a valid token', async () => {
      const res = await request(app.getHttpServer())
        .delete('/auth/logout')
        .expect(401);

      expect(res.body.message).toContain('Please login');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should issue a new access token with a valid refresh token', async () => {
      const credentials = {
        email: 'testuser@email.com',
        password: 'TestPassword.123',
      };
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials);

      const jwtService = app.get(JwtService);
      const payload = jwtService.decode(loginRes.body.accessToken);
      const oldRefreshToken = loginRes.body.refreshToken;

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .set('x-refresh-token', oldRefreshToken)
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');

      const newSessionInDb = await prismaService.userSession.findFirst({
        where: {
          userId: payload.id,
          id: payload.sessionId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(newSessionInDb).not.toBeNull();
      expect(newSessionInDb.refreshToken).not.toEqual(oldRefreshToken);
    });

    it('should reject refresh attempts with an invalid or expired refresh token', async () => {
      const credentials = {
        email: 'testuser@email.com',
        password: 'TestPassword.123',
      };
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(credentials);

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .set('x-refresh-token', 'invalidrefreshtoken')
        .expect(401);

      expect(res.body.message).toContain('Refresh token is invalid.');
    });
  });
});
