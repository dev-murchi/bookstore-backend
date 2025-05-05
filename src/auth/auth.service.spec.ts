import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { RoleEnum } from '../common/role.enum';

import { Password } from '../common/password';
import { CustomAPIError } from '../common/errors/custom-api.error';

const mockPasswordProvider = {
  compare: jest.fn(),
};

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

const mockEmailService = {
  sendResetPasswordMail: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;
  let emailService: EmailService;

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
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: Password,
          useValue: mockPasswordProvider,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should call the create method of userService', async () => {
      const user: CreateUserDto = {
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
      };

      mockUserService.create.mockResolvedValueOnce({
        message: 'User registered successfully',
      });

      const result = await service.register(user, RoleEnum.User);

      expect(userService.create).toHaveBeenCalledWith(user, RoleEnum.User);

      expect(result).toEqual({ message: 'User registered successfully' });
    });

    it('should handle error when userService.create fails', async () => {
      const user: CreateUserDto = {
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
    it('should throw UnauthorizedException error when user is not exist', async () => {
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

    it('should throw UnauthorizedException error when password is incorrect', async () => {
      const user = {
        id: 'user-1',
        name: 'test user',
        email: 'testuser@email.com',
        role: { value: 'user' },
      };

      mockUserService.checkUserWithPassword.mockResolvedValue(user);

      mockPasswordProvider.compare.mockResolvedValueOnce(false);

      try {
        await service.login({
          email: 'testuser@email.com',
          password: 'password123',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Invalid user credentials');
      }
    });

    it('should return an access token if login is successful', async () => {
      const user = {
        id: 'user-1',
        name: 'test user',
        email: 'testuser@email.com',
        role: { value: 'user' },
      };

      mockUserService.checkUserWithPassword.mockResolvedValue(user);
      mockPasswordProvider.compare.mockResolvedValueOnce(true);

      jest
        .spyOn(jwtService, 'signAsync')
        .mockResolvedValue('accesstoken' as never);

      const result = await service.login({
        email: 'testuser@email.com',
        password: 'password123',
      });

      expect(result).toEqual({ accessToken: 'accesstoken' });
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
        roleid: 1,
        is_active: true,
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
      expect(emailService.sendResetPasswordMail).toHaveBeenCalledWith(
        'testuser@email.com',
        'test user',
        'http://localhost/reset-password?token=mockToken',
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
});
