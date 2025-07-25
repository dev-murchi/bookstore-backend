import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from 'src/auth/guards//jwt-auth.guard';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { SignupDTO } from 'src/common/dto/signup.dto';
import { UserDTO } from 'src/common/dto/user.dto';
import { RoleEnum } from 'src/common/enum/role.enum';
import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  logout: jest.fn(),
  accessToken: jest.fn(),
  refreshToken: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        handleRequest: jest.fn(),
      })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should throw BadRequestException when known error occurs', async () => {
      const signupData: SignupDTO = {
        email: 'testuser@email.com',
        password: 'TestPassword123.',
        name: 'test user',
      };
      mockAuthService.register.mockRejectedValueOnce(
        new CustomAPIError('Email already in use'),
      );

      try {
        await controller.register(signupData);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Email already in use');
      }
    });

    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      const signupData = {
        email: null, // email cannot be null
        password: 'TestPassword123.',
        name: 'test user',
      } as SignupDTO;
      mockAuthService.register.mockRejectedValueOnce(
        new Error('Unknown Error'),
      );

      try {
        await controller.register(signupData);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('User registration failed.');
      }
    });

    it('should return UserDTO on successfull registration ', async () => {
      const signupData: SignupDTO = {
        email: 'testuser@email.com',
        password: 'TestPassword123.',
        name: 'test user',
      };
      const userData: UserDTO = {
        id: 'user-uuid-1',
        name: 'test user',
        email: 'testuser@email.com',
        role: RoleEnum.User,
      };
      mockAuthService.register.mockResolvedValueOnce(userData);

      const result = await controller.register(signupData);
      expect(result).toEqual(userData);
      expect(mockAuthService.register).toHaveBeenCalledWith(
        signupData,
        RoleEnum.User,
      );
    });
  });

  describe('createAuthor', () => {
    it('should throw BadRequestException when known error occurs', async () => {
      const signupData: SignupDTO = {
        email: 'testauthor@email.com',
        password: 'TestPassword123.',
        name: 'test author',
      };
      mockAuthService.register.mockRejectedValueOnce(
        new CustomAPIError('Email already in use'),
      );

      try {
        await controller.createAuthor(signupData);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Email already in use');
      }
    });

    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      const signupData = {
        email: null, // email cannot be null
        password: 'TestPassword123.',
        name: 'test author',
      } as SignupDTO;
      mockAuthService.register.mockRejectedValueOnce(
        new Error('Unknown Error'),
      );

      try {
        await controller.createAuthor(signupData);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('User registration failed.');
      }
    });

    it('should return UserDTO on successfull registration ', async () => {
      const signupData: SignupDTO = {
        email: 'testauthor@email.com',
        password: 'TestPassword123.',
        name: 'test author',
      };
      const userData: UserDTO = {
        id: 'user-uuid-1',
        name: 'test author',
        email: 'testauthor@email.com',
        role: RoleEnum.User,
      };
      mockAuthService.register.mockResolvedValueOnce(userData);

      const result = await controller.createAuthor(signupData);
      expect(result).toEqual(userData);
      expect(mockAuthService.register).toHaveBeenCalledWith(
        signupData,
        RoleEnum.Author,
      );
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException when user credentials are invalid', async () => {
      const loginData = {
        email: 'testuser@email.com',
        password: 'InvalidPassword123.',
      };
      mockAuthService.login.mockRejectedValueOnce(
        new UnauthorizedException('Invalid user credentials'),
      );

      try {
        await controller.login(loginData);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Invalid user credentials');
      }
    });

    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      const loginData = {
        email: null,
        password: 'InvalidPassword123.',
      };
      mockAuthService.login.mockRejectedValueOnce(new Error('Unknown Error'));
      try {
        await controller.login(loginData);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe('User login failed.');
      }
    });

    it('should return accessToken and refreshToken on successful login', async () => {
      const loginData = {
        email: 'testuser@email.com',
        password: 'TestPassword123.',
      };
      const accessToken = 'jwt-access-token';
      const refreshToken = 'non-jwt-refresh-token';
      mockAuthService.login.mockResolvedValueOnce({
        accessToken,
        refreshToken,
      });
      const result = await controller.login(loginData);
      expect(result).toEqual({ accessToken, refreshToken });
    });
  });

  describe('forgotPassword', () => {
    it('should throw BadRequestException when known error occurs', async () => {
      const passwordResetRequestData = {
        email: 'testuser@email.com',
      };

      mockAuthService.forgotPassword.mockRejectedValueOnce(
        new CustomAPIError('Known Error'),
      );
      try {
        await controller.forgotPassword(passwordResetRequestData);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Known Error');
      }
    });
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      const passwordResetRequestData = {
        email: 'testuser@email.com',
      };
      mockAuthService.forgotPassword.mockRejectedValueOnce(
        new Error('Unknown Error'),
      );
      try {
        await controller.forgotPassword(passwordResetRequestData);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Something went wrong. Please try again later.',
        );
      }
    });

    it('should return success message when password reset email is sent', async () => {
      const passwordResetRequestData = {
        email: 'testuser@email.com',
      };
      const message = 'Please check your email for reset password link.';
      mockAuthService.forgotPassword.mockResolvedValueOnce({ message });
      const result = await controller.forgotPassword(passwordResetRequestData);
      expect(result).toEqual({ message });
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestException when known error occurs', async () => {
      const passwordResetData = {
        email: 'testuser@email.com',
        token: 'reset-token',
        newPassword: 'NewPassword123.',
      };
      mockAuthService.resetPassword.mockRejectedValueOnce(
        new CustomAPIError('Known Error'),
      );
      try {
        await controller.resetPassword(passwordResetData);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Known Error');
      }
    });
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      const passwordResetData = {
        email: 'testuser@email.com',
        token: 'reset-token',
        newPassword: 'NewPassword123.',
      };
      mockAuthService.resetPassword.mockRejectedValueOnce(
        new Error('Unknown Error'),
      );
      try {
        await controller.resetPassword(passwordResetData);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe('Password reset failed.');
      }
    });
    it('should reset the password successfully', async () => {
      const passwordResetData = {
        email: 'testuser@email.com',
        token: 'reset-token',
        newPassword: 'NewPassword123.',
      };
      const message = 'Password reset successfully';
      mockAuthService.resetPassword.mockResolvedValueOnce({ message });
      const result = await controller.resetPassword(passwordResetData);
      expect(result).toEqual({ message });
    });
  });

  describe('logout', () => {
    const request = {
      user: {
        id: 'user-uuid-1',
        sessionId: 'user-session-id-1',
      },
    } as any;
    it('should throw UnauthorizedException when user is not logged in', async () => {
      const requestData = { ...request, user: null } as any;
      try {
        await controller.logout(requestData);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Please login');
      }
    });
    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockAuthService.logout.mockRejectedValueOnce(new Error('Unknown Error'));
      try {
        await controller.logout(request);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe('Logout failed.');
      }
    });
    it('should logout the user successfully', async () => {
      mockAuthService.logout.mockResolvedValueOnce(undefined);
      const result = await controller.logout(request);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('refreshToken', () => {
    const request = {
      user: {
        id: 'user-uuid-1',
        sessionId: 'user-session-id-1',
        role: RoleEnum.User,
      },
    } as any;
    it('should throw InternalServerErrorException when accessTokeen creation fails', async () => {
      const requestData = { ...request, user: {} } as any;
      mockAuthService.accessToken.mockRejectedValueOnce(
        new Error('Unknow Error while creating access token'),
      );
      try {
        await controller.refreshToken(requestData);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe('Failed to refresh token.');
        expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
      }
    });
    it('should throw InternalServerErrorException when refreshToken creation fails', async () => {
      const accesToken = 'new-access-token.jwt...';
      mockAuthService.accessToken.mockResolvedValueOnce(accesToken);
      mockAuthService.refreshToken.mockRejectedValueOnce(
        new Error('Unknown Error while creating refresh token'),
      );

      try {
        await controller.refreshToken(request);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe('Failed to refresh token.');
      }
    });
    it('should return new access token and refresh token on successfull token refresh', async () => {
      const accessToken = 'new-access-token.jwt...';
      const refreshToken = 'new-refresh-token...';
      mockAuthService.accessToken.mockResolvedValueOnce(accessToken);
      mockAuthService.refreshToken.mockResolvedValueOnce({
        token: refreshToken,
      });
      const result = await controller.refreshToken(request);
      expect(result).toEqual({ accessToken, refreshToken });
    });
  });
});
