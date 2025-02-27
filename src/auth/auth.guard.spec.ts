import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthGuard', () => {
  let authGuard: AuthGuard;
  let jwtService: JwtService;

  beforeEach(async () => {
    const mockJwtService = {
      verifyAsync: jest.fn(),
      sign: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('secret-key'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    authGuard = module.get<AuthGuard>(AuthGuard);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(authGuard).toBeDefined();
  });

  it('should throw UnauthorizedException if no token is provided', async () => {
    const mockRequest = { headers: {} };

    try {
      await authGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as any);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('No token provided');
    }
  });

  it('should throw UnauthorizedException if an invalid token is provided', async () => {
    const invalidToken = 'invalid_token';
    const mockRequest = {
      headers: { authorization: `Bearer ${invalidToken}` },
    };

    jest
      .spyOn(jwtService, 'verifyAsync')
      .mockRejectedValue(new UnauthorizedException('Invalid token'));

    try {
      await authGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as any);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('Unauthorized');
    }
  });

  it('should throw UnauthorizedException if the token format is incorrect (not "Bearer <token>")', async () => {
    const invalidFormatToken = 'invalidToken';
    const mockRequest = { headers: { authorization: invalidFormatToken } };

    try {
      await authGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as any);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('No token provided');
    }
  });

  it('should attach the decoded user to the request object and allow the request when a valid token is provided', async () => {
    const validToken = 'valid_token';
    const mockDecoded = { id: 1, role: 'user' };
    const mockRequest = { headers: { authorization: `Bearer ${validToken}` } };

    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockDecoded);

    const result = await authGuard.canActivate({
      switchToHttp: () => ({ getRequest: () => mockRequest }),
    } as any);

    expect(mockRequest['user']).toEqual(mockDecoded);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException if the token is malformed (e.g., missing parts)', async () => {
    const malformedToken = 'Bearer';
    const mockRequest = { headers: { authorization: malformedToken } };

    try {
      await authGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as any);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('No token provided');
    }
  });
  it('should throw UnauthorizedException if an empty token is provided', async () => {
    const emptyToken = 'Bearer ';
    const mockRequest = { headers: { authorization: emptyToken } };

    try {
      await authGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => mockRequest }),
      } as any);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.message).toBe('No token provided');
    }
  });
});
