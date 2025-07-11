import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from 'src/user/user.service';
import { SignupDTO } from 'src/common/dto/signup.dto';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { RoleEnum } from 'src/common/enum/role.enum';

import { HelperService } from 'src/common/helper.service';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { ConfigService } from '@nestjs/config';
import { UserSessionService } from 'src/user/user-session/user-session.service';
import { QueueService } from 'src/queue/queue.service';

const mockUserService = {
  create: jest.fn(),
  findByEmail: jest.fn(),
  update: jest.fn(),
  createPasswordResetToken: jest.fn(),
  resetPassword: jest.fn(),
  checkUserWithPassword: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
};

const mockQueueService = {
  addAuthMailJob: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockImplementation((key: any) => {
    if (key === 'jwt.secret') return 'secret key';
    if (key === 'jwt.expiresIn') return '15m';
    return null;
  }),
};
const mockUserSessionService = {
  createSession: jest.fn(),
  deleteSession: jest.fn(),
  updateSession: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },

        {
          provide: QueueService,
          useValue: mockQueueService,
        },

        { provide: ConfigService, useValue: mockConfigService },
        { provide: UserSessionService, useValue: mockUserSessionService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should call the create method of userService', async () => {
      const data: SignupDTO = {
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
      };

      mockUserService.create.mockResolvedValueOnce({
        message: 'User registered successfully',
      });

      const result = await service.register(data, RoleEnum.User);

      expect(userService.create).toHaveBeenCalledWith({
        ...data,
        role: RoleEnum.User,
      });

      expect(result).toEqual({ message: 'User registered successfully' });
    });

    it('should handle error when userService.create fails', async () => {
      const user: SignupDTO = {
        name: 'test user',
        email: 'test email',
        password: 'password123',
      };

      mockUserService.create.mockRejectedValueOnce(
        new CustomAPIError('User creation failed'),
      );

      await expect(service.register(user, RoleEnum.User)).rejects.toThrow(
        'User creation failed',
      );
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException error when user credentials are invalid', async () => {
      mockUserService.checkUserWithPassword.mockRejectedValueOnce(
        new CustomAPIError('Invalid credentials'),
      );
      try {
        await service.login({
          email: 'testuser@email.com',
          password: 'password123',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Invalid credentials');
      }
    });

    it('should return an access token if login is successful', async () => {
      const user = {
        id: 'user-1',
        name: 'test user',
        email: 'testuser@email.com',
        role: { value: 'user' },
      };

      mockUserService.checkUserWithPassword.mockResolvedValueOnce(user);
      const spy = jest.spyOn(HelperService, 'generateToken');
      const spy2 = jest.spyOn(HelperService, 'hashToken');
      spy.mockReturnValueOnce('refresh-token' as never);
      spy2.mockReturnValueOnce('refresh-token-hash' as never);

      mockUserSessionService.createSession.mockResolvedValueOnce({
        id: 'session-id-1',
        userId: 'user-1',
        refreshToken: null,
        refreshRequired: false,
      });

      mockJwtService.signAsync.mockResolvedValueOnce('accesstoken' as never);

      const result = await service.login({
        email: 'testuser@email.com',
        password: 'password123',
      });

      expect(result).toEqual({
        accessToken: 'accesstoken',
        refreshToken: 'refresh-token',
      });
      spy.mockRestore();
      spy2.mockRestore();
    });

    it('should rethrow unknown errors during login', async () => {
      const email = 'user@mail.com';
      const password = 'password';
      mockUserService.checkUserWithPassword.mockRejectedValueOnce(
        new Error('Error'),
      );

      try {
        await service.login({ email, password });
      } catch (error) {
        expect(error).not.toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Error');
      }
    });
  });

  describe('forgotPassword', () => {
    it('should return a message when user is not found, without creating a token', async () => {
      mockUserService.findByEmail.mockReturnValueOnce(null);
      const result = await service.forgotPassword('testuser@email.com');
      expect(result).toEqual({
        message: 'Please check your email for reset password link.',
      });

      expect(userService.findByEmail).toHaveBeenCalledWith(
        'testuser@email.com',
      );
      expect(userService.createPasswordResetToken).not.toHaveBeenCalled();
    });
    it('should return a reset password URL if the user is found and token is saved', async () => {
      mockUserService.findByEmail.mockReturnValueOnce({
        id: 1,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        roleId: 1,
        isActive: true,
      });

      mockUserService.createPasswordResetToken.mockReturnValueOnce({
        token: 'mockToken',
        expiresAt: expect.any(Date),
      });
      const result = await service.forgotPassword('testuser@email.com');

      expect(result).toEqual({
        message: 'Please check your email for reset password link.',
      });

      expect(userService.findByEmail).toHaveBeenCalledWith(
        'testuser@email.com',
      );
      expect(mockQueueService.addAuthMailJob).toHaveBeenCalledWith(
        'authPasswordReset',
        {
          email: 'testuser@email.com',
          username: 'test user',
          passwordResetLink: 'http://localhost/reset-password?token=mockToken',
        },
      );
    });
    it('should handle unexpected errors gracefully in the userService', async () => {
      mockUserService.findByEmail.mockRejectedValue(
        new Error('Service failure'),
      );

      try {
        await service.forgotPassword('testuser@email.com');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Service failure');
      }
    });
  });

  describe('resetPassword', () => {
    it('should throw an error if the password reset operation failes', async () => {
      mockUserService.resetPassword.mockRejectedValueOnce(
        new CustomAPIError('Something went wrong'),
      );

      try {
        await service.resetPassword({
          email: 'testuser@email.com',
          token: 'invalid-token',
          newPassword: 'newpassword',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Something went wrong');
      }
    });

    it('should reset the password successfully', async () => {
      mockUserService.resetPassword.mockResolvedValueOnce({
        message: 'Password reset successfully',
      });
      const result = await service.resetPassword({
        email: 'testuser@email.com',
        token: 'token',
        newPassword: 'newpassword',
      });

      expect(result).toEqual({ message: 'Password reset successfully' });
    });
  });

  describe('refreshToken', () => {
    it('should handle the errors', async () => {
      mockUserSessionService.updateSession.mockRejectedValueOnce('Error');
      await expect(
        service.refreshToken('user-uuid-1', 'session-id-1'),
      ).rejects.toThrow('User session update failed');
    });

    it('should create and return the refresh token', async () => {
      const spy1 = jest.spyOn(HelperService, 'generateToken');
      const spy2 = jest.spyOn(HelperService, 'hashToken');
      spy1.mockReturnValueOnce('token-value');
      spy2.mockReturnValueOnce('token-hash');
      mockUserSessionService.updateSession.mockResolvedValueOnce({});

      const result = await service.refreshToken('user-uuid-1', 'session-id-1');
      expect(result).toEqual({ token: 'token-value' });
      spy1.mockRestore();
      spy2.mockRestore();
    });
  });

  describe('logout', () => {
    it('shoul call deleteSession method from the user session service', async () => {
      mockUserSessionService.deleteSession.mockResolvedValueOnce({});
      await service.logout('user-uuid-1', 'session-id-1');
      expect(mockUserSessionService.deleteSession).toHaveBeenCalledTimes(1);
      expect(mockUserSessionService.deleteSession).toHaveBeenCalledWith(
        'user-uuid-1',
        'session-id-1',
      );
    });
  });
});
