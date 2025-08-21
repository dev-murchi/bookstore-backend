import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from 'express';

const mockConfigService = {
  get: jest.fn().mockReturnValue('secret'),
};

const mockJwtService = {
  verify: jest.fn(),
};

const mockPrismaService = {
  userSession: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const mockRequest = {
  headers: {
    authorization: 'Bearer valid.token',
  },
} as unknown as Request;

const baseUserSession = {
  refreshToken: 'some-refresh-token',
  refreshRequired: false,
  expiresAt: new Date(Date.now() + 10_000),
  user: {
    id: 'user123',
    name: 'Test User',
    email: 'testuser@email.com',
    role: { name: 'admin' },
    cart: { id: 'cart123' },
    password: 'hashed',
    lastPasswordResetAt: new Date(Date.now() - 500_000),
  },
};

const payload = {
  id: 'user123',
  sessionId: 'session123',
  logedInAt: new Date(Date.now() - 10 * 1000),
  iat: Math.floor(Date.now() / 1000) - 200,
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);

    jest.clearAllMocks();
  });

  it.only('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it.only('should throw if token is malformed', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw { name: 'JsonWebTokenError' };
    });

    await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
      'Access token is invalid or malformed.',
    );
  });

  it.only('should throw if user session is not found', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw { name: 'TokenExpiredError' };
    });
    mockPrismaService.userSession.findUnique.mockResolvedValueOnce(null);

    await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
      'User session id not found. Please login',
    );
  });

  it.only('should throw if password was reset after token issued', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw { name: 'TokenExpiredError' };
    });

    const session = {
      ...baseUserSession,
      user: {
        ...baseUserSession.user,
        lastPasswordResetAt: new Date(Date.now() + 100_000), // in the future
      },
    };

    mockPrismaService.userSession.findUnique.mockResolvedValueOnce(session);

    await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
      'Session expired due to password change. Please log in again.',
    );
  });

  it.only('should throw if token is expired and session is expired', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw { name: 'TokenExpiredError' };
    });

    const session = {
      ...baseUserSession,
      expiresAt: new Date(Date.now() - 100_000),
    };

    mockPrismaService.userSession.findUnique.mockResolvedValueOnce(session);

    await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
      'Expired token. Please login.',
    );
  });

  it.only('should throw if refreshRequired is true', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw { name: 'TokenExpiredError' };
    });

    const session = {
      ...baseUserSession,
      refreshRequired: true,
    };

    mockPrismaService.userSession.findUnique.mockResolvedValueOnce(session);

    await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
      'Expired token. Please refresh your token.',
    );
  });

  it.only('should mark session as refreshRequired if expired and return tokenRefreshRequired=true', async () => {
    mockJwtService.verify.mockImplementation(() => {
      throw { name: 'TokenExpiredError' };
    });

    const session = {
      ...baseUserSession,
      refreshRequired: false,
    };

    mockPrismaService.userSession.findUnique.mockResolvedValueOnce(session);
    mockPrismaService.userSession.update.mockResolvedValueOnce({});

    const result = await strategy.validate(mockRequest, payload);

    expect(mockPrismaService.userSession.update).toHaveBeenCalled();
    expect(result.tokenRefreshRequired).toBe(true);
  });

  it.only('should throw generic UnauthorizedException on unknown error', async () => {
    mockJwtService.verify.mockResolvedValueOnce(true);
    mockPrismaService.userSession.findUnique.mockRejectedValueOnce(
      new Error('Unexpected error'),
    );

    await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
      'Authentication failed.',
    );
  });

  it.only('should validate a correct token when user has no cart', async () => {
    mockJwtService.verify.mockReturnValueOnce(true);
    mockPrismaService.userSession.findUnique.mockResolvedValueOnce({
      ...baseUserSession,
      user: {
        ...baseUserSession.user,
        cart: null,
      },
    });

    const result = await strategy.validate(mockRequest, payload);

    expect(result).toMatchObject({
      id: 'user123',
      name: 'Test User',
      email: 'testuser@email.com',
      role: 'admin',
      cartId: null,
      sessionId: 'session123',
      password: 'hashed',
      tokenRefreshRequired: false,
    });
  });

  it.only('should validate a correct token when user has cart', async () => {
    mockJwtService.verify.mockReturnValueOnce(true);
    mockPrismaService.userSession.findUnique.mockResolvedValueOnce(
      baseUserSession,
    );

    const result = await strategy.validate(mockRequest, payload);

    expect(result).toMatchObject({
      id: 'user123',
      name: 'Test User',
      email: 'testuser@email.com',
      role: 'admin',
      cartId: 'cart123',
      sessionId: 'session123',
      password: 'hashed',
      tokenRefreshRequired: false,
    });
  });
});
