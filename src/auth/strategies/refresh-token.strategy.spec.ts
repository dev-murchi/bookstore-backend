import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RefreshTokenStrategy } from './refresh-token.strategy';
import { Request } from 'express';
import { HelperService } from '../../common/helper.service';

describe('RefreshTokenStrategy', () => {
  let strategy: RefreshTokenStrategy;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  const mockPrismaService = {
    userSession: {
      findUnique: jest.fn(),
    },
  };

  const payload = {
    id: 'user123',
    sessionId: 'session123',
    iat: Math.floor(Date.now() / 1000) - 100,
  };

  const mockRequest = {
    headers: {
      authorization: 'Bearer some.jwt.token',
      'x-refresh-token': 'client-refresh-token',
    },
  } as unknown as Request;

  const mockUserSession = {
    refreshToken: 'hashed-refresh-token',
    expiresAt: new Date(Date.now() + 60 * 1000),
    user: {
      id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      role: { name: 'admin' },
      cart: { id: 'cart123' },
      lastPasswordResetAt: new Date(Date.now() - 500_000),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(HelperService, 'verifyTokenHash').mockReturnValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    strategy = module.get<RefreshTokenStrategy>(RefreshTokenStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should throw if no refresh token in headers', async () => {
    const reqWithoutToken = {
      headers: {},
    } as Request;

    await expect(strategy.validate(reqWithoutToken, payload)).rejects.toThrow(
      'Refresh token not found in headers',
    );
  });

  it('should throw if session is not found', async () => {
    mockPrismaService.userSession.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
      'Session not found. Please login.',
    );
  });

  it('should throw if refresh token is invalid', async () => {
    jest.spyOn(HelperService, 'verifyTokenHash').mockReturnValue(false);
    mockPrismaService.userSession.findUnique.mockResolvedValue(mockUserSession);

    await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
      'Refresh token is invalid.',
    );
  });

  it('should throw if password was reset after token issued', async () => {
    const session = {
      ...mockUserSession,
      user: {
        ...mockUserSession.user,
        lastPasswordResetAt: new Date(Date.now() + 60 * 1000),
      },
    };
    mockPrismaService.userSession.findUnique.mockResolvedValue(session);

    await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
      'Session expired due to password change. Please log in again.',
    );
  });

  it('should throw if refresh token is expired', async () => {
    const session = {
      ...mockUserSession,
      expiresAt: new Date(Date.now() - 60 * 1000),
    };
    mockPrismaService.userSession.findUnique.mockResolvedValue(session);

    await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
      'Expired refresh token. Please login again.',
    );
  });

  it('should throw generic UnauthorizedException on unexpected error', async () => {
    mockPrismaService.userSession.findUnique.mockImplementation(() => {
      throw new Error('Unexpected DB error');
    });

    await expect(strategy.validate(mockRequest, payload)).rejects.toThrow(
      'Refresh failed.',
    );
  });

  it('should validate a correct refresh token when user has no cart', async () => {
    mockPrismaService.userSession.findUnique.mockResolvedValue({
      ...mockUserSession,
      user: { ...mockUserSession.user, cart: null },
    });

    const result = await strategy.validate(mockRequest, payload);

    expect(result).toEqual({
      id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      cartId: null,
      sessionId: 'session123',
    });
  });

  it('should validate a correct refresh token when user has cart', async () => {
    mockPrismaService.userSession.findUnique.mockResolvedValue(mockUserSession);

    const result = await strategy.validate(mockRequest, payload);

    expect(result).toEqual({
      id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
      cartId: 'cart123',
      sessionId: 'session123',
    });
  });
});
