import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDTO } from '../common/dto/signup.dto';
import { LoginDTO } from '../common/dto/login.dto';
import { PasswordResetRequestDTO } from '../common/dto/password-reset-request.dto';
import { PasswordResetDTO } from '../common/dto/password-reset.dto';
import { RoleEnum } from '../common/enum/role.enum';
import { Roles } from '../common/decorator/role/role.decorator';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { UserDTO } from '../common/dto/user.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiUnauthorizedResponse,
  ApiOkResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/auth/jwt-auth.guard';
import { RefreshGuard } from '../common/guards/refresh.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: SignupDTO })
  @ApiCreatedResponse({
    description: 'User successfully registered',
    schema: {
      example: {
        id: 'abcdef01-2345-6789-abcd-ef0123456789',
        email: 'newuser@email.com',
        name: 'John Doe',
        role: { value: 'user' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Bad request or validation failed' })
  @ApiInternalServerErrorResponse({ description: 'User registration failed' })
  async register(@Body() signupDto: SignupDTO): Promise<UserDTO> {
    try {
      return await this.authService.register(signupDto, RoleEnum.User);
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException('User registration failed.');
    }
  }

  @Post('create-author')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  @ApiOperation({ summary: 'Create an author account (admin only)' })
  @ApiBearerAuth()
  @ApiBody({ type: SignupDTO })
  @ApiCreatedResponse({
    description: 'Author account created successfully',
    schema: {
      example: {
        id: 'abcdef01-2345-6789-abcd-ef0123456789',
        email: 'newuser@email.com',
        name: 'John Doe',
        role: { value: 'author' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Bad request or validation failed' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized. Only admins can access this endpoint.',
  })
  @ApiInternalServerErrorResponse({ description: 'User registration failed' })
  async createAuthor(@Body() signupDto: SignupDTO): Promise<UserDTO> {
    try {
      return await this.authService.register(signupDto, RoleEnum.Author);
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException('User registration failed.');
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login a user and get access and refresh tokens' })
  @ApiBody({ type: LoginDTO })
  @ApiOkResponse({
    description: 'Login successful',
    schema: {
      example: {
        accessToken: 'jwt-token-string',
        refreshToken: 'jwt-token-string',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiInternalServerErrorResponse({ description: 'Login failed' })
  async login(
    @Body() loginDto: LoginDTO,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      return await this.authService.login(loginDto);
    } catch (error) {
      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException('User login failed.');
    }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a password reset link to the user email' })
  @ApiBody({ type: PasswordResetRequestDTO })
  @ApiOkResponse({
    description: 'Password reset email sent',
    schema: { example: { message: 'Password reset link sent to your email.' } },
  })
  @ApiBadRequestResponse({ description: 'Invalid request' })
  @ApiInternalServerErrorResponse({ description: 'Internal server error' })
  async forgotPassword(
    @Body() passwordResetRequestDto: PasswordResetRequestDTO,
  ): Promise<{ message: string }> {
    try {
      const { email } = passwordResetRequestDto;
      return await this.authService.forgotPassword(email);
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException(
        'Something went wrong. Please try again later.',
      );
    }
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using the token received in email' })
  @ApiBody({ type: PasswordResetDTO })
  @ApiOkResponse({
    description: 'Password successfully reset',
    schema: { example: { message: 'Password has been reset successfully.' } },
  })
  @ApiBadRequestResponse({ description: 'Bad request or invalid token' })
  @ApiInternalServerErrorResponse({ description: 'Password reset failed' })
  async resetPassword(
    @Body() passwordResetDto: PasswordResetDTO,
  ): Promise<{ message: string }> {
    try {
      return await this.authService.resetPassword(passwordResetDto);
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException('Password reset failed.');
    }
  }

  @Delete('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out of the current session' })
  @ApiOkResponse({
    description: 'Successfully logged out',
    schema: { example: { message: 'Logged out successfully' } },
  })
  @ApiUnauthorizedResponse({
    description: 'User is not authenticated or session is invalid',
  })
  @ApiInternalServerErrorResponse({
    description: 'Logout failed due to server error',
  })
  async logout(@Req() request: Request) {
    try {
      const { user } = request;
      if (!user || !user['id'] || !user['sessionId']) {
        throw new UnauthorizedException('Please login');
      }
      console.log({ user });
      await this.authService.logout(user['id'], user['sessionId']);
      return { message: 'Logged out successfully' };
    } catch (error) {
      console.error('Logout failed. Error:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Logout failed.');
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RefreshGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiHeader({
    name: 'x-refresh-token',
    description: 'Refresh token (non-JWT)',
    required: true,
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @ApiOkResponse({
    description: 'New access and refresh tokens issued',
    schema: {
      example: {
        accessToken: 'new-access-token.jwt...',
        refreshToken: 'new-refresh-token',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  @ApiInternalServerErrorResponse({
    description: 'Failed to refresh token due to internal error',
  })
  async refreshToken(@Req() request: Request) {
    const { user } = request;
    const accessToken = await this.authService.accessToken({
      id: user['id'],
      role: user['role'],
      sessionId: user['sessionId'],
    });
    const { token: refreshToken } = await this.authService.refreshToken(
      user['id'],
      user['sessionId'],
    );

    return { accessToken, refreshToken };
  }
}
