import { Test, TestingModule } from '@nestjs/testing';
import { UserAccessGuard } from './user-access.guard';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { RoleEnum } from '../../enum/role.enum';
const mockReflector = {
  getAllAndMerge: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: any) => {
    if (key === 'JWT_SECRET') return 'secret key';
    return null;
  }),
};

const mockJwtService = {
  verifyAsync: jest.fn(),
};

const mockPrismaService = {
  user: { findUnique: jest.fn() },
};

const mockRequest: any = {
  headers: {},
};

const mockExecutionContext: Partial<ExecutionContext> = {
  switchToHttp: jest.fn().mockReturnValue({
    getRequest: jest.fn(),
  }),
  getHandler: jest.fn(),
  getClass: jest.fn(),
};

describe('UserAccessGuard', () => {
  let userAccessGuard: UserAccessGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAccessGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    userAccessGuard = module.get<UserAccessGuard>(UserAccessGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(userAccessGuard).toBeDefined();
  });

  it('should throw if guest user is not allowed and no token is present', async () => {
    (mockReflector.getAllAndMerge as jest.Mock).mockReturnValueOnce([]);

    mockRequest.headers.authorization = undefined;

    (mockExecutionContext.switchToHttp as jest.Mock).mockReturnValueOnce({
      getRequest: () => mockRequest,
    });
    await expect(
      userAccessGuard.canActivate(mockExecutionContext as ExecutionContext),
    ).rejects.toThrow(
      new UnauthorizedException(
        'You are not authorized to perform this operation.',
      ),
    );
  });

  it('should allow guest user if role includes GuestUser and no token is present', async () => {
    (mockReflector.getAllAndMerge as jest.Mock).mockReturnValue([
      RoleEnum.GuestUser,
    ]);
    mockRequest.headers.authorization = undefined;
    (mockExecutionContext.switchToHttp as jest.Mock).mockReturnValue({
      getRequest: () => mockRequest,
    });

    const result = await userAccessGuard.canActivate(
      mockExecutionContext as ExecutionContext,
    );
    expect(result).toBe(true);
    expect(mockRequest.user).toBeFalsy();
  });

  it('should validate token, fetch user and allow if user role matches', async () => {
    (mockReflector.getAllAndMerge as jest.Mock).mockReturnValue([
      RoleEnum.User,
    ]);
    mockRequest.headers.authorization = 'Bearer valid.token';
    (mockExecutionContext.switchToHttp as jest.Mock).mockReturnValue({
      getRequest: () => mockRequest,
    });
    (mockConfigService.get as jest.Mock).mockReturnValue('secret');
    (mockJwtService.verifyAsync as jest.Mock).mockResolvedValue({ id: 1 });
    mockPrismaService.user.findUnique.mockResolvedValueOnce({
      name: 'test user',
      password: 'password',
      id: 1,
      userid: 'user-uuid-1',
      email: 'test@example.com',
      role: {
        id: 1,
        role_name: 'user',
      },
      cart: { id: 10 },
      is_active: true,
    });

    const result = await userAccessGuard.canActivate(
      mockExecutionContext as ExecutionContext,
    );
    expect(result).toBe(true);
    expect(mockRequest.user).toEqual({
      id: 'user-uuid-1',
      name: 'test user',
      email: 'test@example.com',
      role: RoleEnum.User,
      cartId: 10,
    });
  });

  it('should throw if user not found', async () => {
    (mockReflector.getAllAndMerge as jest.Mock).mockReturnValue([
      RoleEnum.User,
    ]);
    mockRequest.headers.authorization = 'Bearer valid.token';
    (mockExecutionContext.switchToHttp as jest.Mock).mockReturnValue({
      getRequest: () => mockRequest,
    });
    (mockConfigService.get as jest.Mock).mockReturnValue('secret');
    (mockJwtService.verifyAsync as jest.Mock).mockResolvedValue({ id: 99 });
    mockPrismaService.user.findUnique.mockResolvedValue(null);

    await expect(
      userAccessGuard.canActivate(mockExecutionContext as ExecutionContext),
    ).rejects.toThrow(
      new UnauthorizedException(
        'User authentication failed. Please log in again.',
      ),
    );
  });

  it('should throw if user role is not allowed', async () => {
    (mockReflector.getAllAndMerge as jest.Mock).mockReturnValue([
      RoleEnum.User,
    ]);
    mockRequest.headers.authorization = 'Bearer valid.token';
    (mockExecutionContext.switchToHttp as jest.Mock).mockReturnValue({
      getRequest: () => mockRequest,
    });
    (mockConfigService.get as jest.Mock).mockReturnValue('secret');
    (mockJwtService.verifyAsync as jest.Mock).mockResolvedValue({ id: 1 });

    mockPrismaService.user.findUnique.mockResolvedValueOnce({
      name: 'test user',
      password: 'password',
      id: 1,
      userid: 'user-uuid-1',
      email: 'test@example.com',
      role: {
        id: 2,
        role_name: 'admin',
      },
      cart: null,
      is_active: true,
    });

    await expect(
      userAccessGuard.canActivate(mockExecutionContext as ExecutionContext),
    ).rejects.toThrow(
      new UnauthorizedException(
        'You do not have permission to access this resource.',
      ),
    );
  });

  it('should throw UnauthorizedException if token is expired', async () => {
    (mockReflector.getAllAndMerge as jest.Mock).mockReturnValue([
      RoleEnum.User,
    ]);
    mockRequest.headers.authorization = 'Bearer expired.token';
    (mockExecutionContext.switchToHttp as jest.Mock).mockReturnValue({
      getRequest: () => mockRequest,
    });
    (mockConfigService.get as jest.Mock).mockReturnValue('secret');
    (mockJwtService.verifyAsync as jest.Mock).mockRejectedValue(
      new TokenExpiredError('Token expired', new Date()),
    );

    await expect(
      userAccessGuard.canActivate(mockExecutionContext as ExecutionContext),
    ).rejects.toThrow(
      new UnauthorizedException('Token has expired. Please log in again.'),
    );
  });

  it('should throw generic UnauthorizedException on unknown error', async () => {
    (mockReflector.getAllAndMerge as jest.Mock).mockReturnValue([
      RoleEnum.User,
    ]);
    mockRequest.headers.authorization = 'Bearer bad.token';
    (mockExecutionContext.switchToHttp as jest.Mock).mockReturnValue({
      getRequest: () => mockRequest,
    });
    (mockConfigService.get as jest.Mock).mockReturnValue('secret');
    (mockJwtService.verifyAsync as jest.Mock).mockRejectedValue(
      new Error('Unknown'),
    );

    await expect(
      userAccessGuard.canActivate(mockExecutionContext as ExecutionContext),
    ).rejects.toThrow(
      new UnauthorizedException(
        'Unauthorized operation. Please check your credentials and try again.',
      ),
    );
  });
});
