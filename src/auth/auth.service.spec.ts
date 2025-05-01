import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { MailSenderService } from '../mail-sender/mail-sender.service';
import { RoleEnum } from '../common/role.enum';

const mockUserService = {
  create: jest.fn(),
  findBy: jest.fn(),
  update: jest.fn(),
  createPasswordResetToken: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
};

const mockPrismaService = {
  password_reset_tokens: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

const mockMailSenderService = {
  sendResetPasswordMail: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;
  let prismaService: PrismaService;
  let mailSenderService: MailSenderService;

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
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: MailSenderService,
          useValue: mockMailSenderService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);
    mailSenderService = module.get<MailSenderService>(MailSenderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should hash the password and call the create method of userService', async () => {
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
        new Error('User creation failed'),
      );

      await expect(service.register(user, RoleEnum.User)).rejects.toThrow(
        'User creation failed',
      );
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException error when user is not exist', async () => {
      jest.spyOn(userService, 'findBy').mockResolvedValue(null as never);
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

    it('should throw UnauthorizedException error when password is incorrect', async () => {
      const user = {
        id: 1,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: 'user',
      };

      jest.spyOn(userService, 'findBy').mockResolvedValue(user as never);

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

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
        id: 1,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        role: 'user',
      };

      jest.spyOn(userService, 'findBy').mockResolvedValue(user as never);

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

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
      mockUserService.findBy.mockReturnValueOnce(null);
      const result = await service.forgotPassword('testuser@email.com');
      expect(result).toEqual({
        message: 'Please check your email for reset password link.',
      });

      expect(userService.findBy).toHaveBeenCalledWith('testuser@email.com');
      expect(userService.createPasswordResetToken).not.toHaveBeenCalled();
    });
    it('should return a reset password URL if the user is found and token is saved', async () => {
      mockUserService.findBy.mockReturnValueOnce({
        id: 1,
        name: 'test user',
        email: 'testuser@email.com',
        password: 'password123',
        roleid: 1,
        is_active: true,
      });

      mockUserService.createPasswordResetToken.mockReturnValueOnce('mockToken');
      const result = await service.forgotPassword('testuser@email.com');

      expect(result).toEqual({
        message: 'Please check your email for reset password link.',
      });

      expect(userService.findBy).toHaveBeenCalledWith('testuser@email.com');
      expect(mailSenderService.sendResetPasswordMail).toHaveBeenCalledWith(
        'testuser@email.com',
        'test user',
        'http://localhost/reset-password?token=mockToken',
      );
    });
    it('should handle unexpected errors gracefully in the userService', async () => {
      mockUserService.findBy.mockRejectedValue(new Error('Service failure'));

      await expect(
        service.forgotPassword('testuser@email.com'),
      ).rejects.toThrow('Something went wrong');
    });
  });

  describe('resetPassword', () => {
    it('should throw an error if the token is invalid', async () => {
      mockPrismaService.password_reset_tokens.findUnique.mockReturnValueOnce(
        null,
      );

      try {
        await service.resetPassword({
          email: 'testuser@email.com',
          token: 'invalid-token',
          newPassword: 'newpassword',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid token');
        expect(
          prismaService.password_reset_tokens.findUnique,
        ).toHaveBeenCalledWith({
          where: {
            token: 'invalid-token',
          },
        });
      }
    });

    it('should throw an error if the token has expired', async () => {
      const mockPasswordResetData = {
        token_id: 1,
        userid: 1,
        token: 'token',
        expires_at: new Date(Date.now() - 60 * 1000), // token expired 1 minute ago
      };
      mockPrismaService.password_reset_tokens.findUnique.mockReturnValueOnce(
        mockPasswordResetData,
      );
      mockPrismaService.password_reset_tokens.delete.mockReturnValueOnce(
        mockPasswordResetData,
      );

      try {
        await service.resetPassword({
          email: 'testuse@email.com',
          token: 'token',
          newPassword: 'newpassword',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid token');
        expect(
          prismaService.password_reset_tokens.findUnique,
        ).toHaveBeenCalledWith({
          where: { token: 'token' },
        });

        expect(prismaService.password_reset_tokens.delete).toHaveBeenCalledWith(
          {
            where: { token: 'token' },
          },
        );
      }
    });

    it('should throw an error if the email does not match the token', async () => {
      const mockPasswordResetData = {
        token_id: 1,
        userid: 1,
        token: 'token',
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // token will expire 10 minutes later
      };
      mockPrismaService.password_reset_tokens.findUnique.mockReturnValue(
        mockPasswordResetData,
      );

      mockUserService.findBy.mockReturnValueOnce(null).mockReturnValueOnce({
        name: 'second user',
        id: 2,
        email: 'seconduser@email.com',
        password: 'oldpassword',
        roleid: 1,
        is_active: true,
      });

      try {
        await service.resetPassword({
          email: 'unknownuser@email.com',
          token: 'token',
          newPassword: 'newpassword',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid email');
      }

      try {
        await service.resetPassword({
          email: 'seconduser@email.com',
          token: 'token',
          newPassword: 'newpassword',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid email');
      }

      mockPrismaService.password_reset_tokens.findUnique.mockClear();
    });

    it('should throw an error if the new password is the same as the old password', async () => {
      mockPrismaService.password_reset_tokens.findUnique.mockReturnValueOnce({
        token_id: 1,
        userid: 1,
        token: 'token',
        expires_at: new Date(Date.now() + 10 * 60 * 1000), // token will expire 10 minutes later
      });

      mockUserService.findBy.mockReturnValueOnce({
        name: 'test user',
        id: 1,
        email: 'testuser@email.com',
        password: 'oldpassword',
        roleid: 1,
        is_active: true,
      });

      jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(true as never);

      try {
        await service.resetPassword({
          email: 'testuser@email.com',
          token: 'token',
          newPassword: 'oldpassword',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          'New password must be different from the current password. Please try again.',
        );
      }
    });
  });

  it('should reset the password successfully', async () => {
    mockPrismaService.password_reset_tokens.findUnique.mockReturnValueOnce({
      token_id: 1,
      userid: 1,
      token: 'token',
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // token will expire 10 minutes later
    });

    mockUserService.findBy.mockReturnValueOnce({
      name: 'test user',
      id: 1,
      email: 'testuser@email.com',
      password: 'oldpassword',
      roleid: 1,
      is_active: true,
    });

    jest.spyOn(bcrypt, 'compare').mockResolvedValueOnce(false as never);
    jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('hashedPassword' as never);

    const result = await service.resetPassword({
      email: 'testuser@email.com',
      token: 'token',
      newPassword: 'newpassword',
    });

    expect(userService.update).toHaveBeenCalledWith(1, {
      password: 'hashedPassword',
    });

    expect(prismaService.password_reset_tokens.delete).toHaveBeenCalledWith({
      where: { token: 'token' },
    });

    expect(result).toEqual({ message: 'Password reset successfully' });
  });
});
