import { Test, TestingModule } from '@nestjs/testing';
import { CartGuard } from './cart.guard';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../../user/user.service';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { RoleEnum } from '../../../common/role.enum';
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

const mockUserService = {
  findOne: jest.fn(),
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

describe('CartGuard', () => {
  let cartGuard: CartGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    cartGuard = module.get<CartGuard>(CartGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(cartGuard).toBeDefined();
  });

  it('should throw if guest user is not allowed and no token is present', async () => {
    (mockReflector.getAllAndMerge as jest.Mock).mockReturnValueOnce([]);

    mockRequest.headers.authorization = undefined;

    (mockExecutionContext.switchToHttp as jest.Mock).mockReturnValueOnce({
      getRequest: () => mockRequest,
    });
    await expect(
      cartGuard.canActivate(mockExecutionContext as ExecutionContext),
    ).rejects.toThrow(new UnauthorizedException('Guest is not allowed'));
  });

  it('should allow guest user if role includes GuestUser and no token is present', async () => {
    (mockReflector.getAllAndMerge as jest.Mock).mockReturnValue([
      RoleEnum.GuestUser,
    ]);
    mockRequest.headers.authorization = undefined;
    (mockExecutionContext.switchToHttp as jest.Mock).mockReturnValue({
      getRequest: () => mockRequest,
    });

    const result = await cartGuard.canActivate(
      mockExecutionContext as ExecutionContext,
    );
    expect(result).toBe(true);
    expect(mockRequest.user).toBeNull();
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
    (mockUserService.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      role: { role_name: RoleEnum.User },
      cart: { id: 10 },
    });

    const result = await cartGuard.canActivate(
      mockExecutionContext as ExecutionContext,
    );
    expect(result).toBe(true);
    expect(mockRequest.user).toEqual({
      id: 1,
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
    (mockUserService.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      cartGuard.canActivate(mockExecutionContext as ExecutionContext),
    ).rejects.toThrow(new UnauthorizedException('User is not exist'));
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
    (mockUserService.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      role: { role_name: RoleEnum.Admin },
      cart: null,
    });

    await expect(
      cartGuard.canActivate(mockExecutionContext as ExecutionContext),
    ).rejects.toThrow(new UnauthorizedException('User is not allowed'));
  });

  it('should throw UnauthorizedException with "Token Expired" on TokenExpiredError', async () => {
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
      cartGuard.canActivate(mockExecutionContext as ExecutionContext),
    ).rejects.toThrow(new UnauthorizedException('Token Expired'));
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
      cartGuard.canActivate(mockExecutionContext as ExecutionContext),
    ).rejects.toThrow(new UnauthorizedException('Unauthorized cart operation'));
  });
});
