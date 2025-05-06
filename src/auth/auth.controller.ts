import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from '../user/dto/login.dto';
import { PasswordResetRequestDto } from '../user/dto/password-reset-request.dto';
import { PasswordResetDto } from '../user/dto/password-reset.dto';
import { RoleEnum } from '../common/role.enum';
import { Roles } from '../common/decorator/role/role.decorator';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { User } from '../common/types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() user: CreateUserDto): Promise<User> {
    try {
      return await this.authService.register(user, RoleEnum.User);
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException('User registeration failed.');
    }
  }

  @Post('create-author')
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async createAuthor(@Body() user: CreateUserDto): Promise<User> {
    try {
      return await this.authService.register(user, RoleEnum.Author);
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException('User registeration failed.');
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() { email, password }: LoginDto,
  ): Promise<{ accessToken: string }> {
    try {
      return await this.authService.login({ email, password });
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      if (error instanceof UnauthorizedException) throw error;

      throw new InternalServerErrorException('User login failed.');
    }
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body() { email }: PasswordResetRequestDto,
  ): Promise<{ message: string }> {
    try {
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
  async resetPassword(
    @Body() { email, token, newPassword }: PasswordResetDto,
  ): Promise<{ message: string }> {
    try {
      return await this.authService.resetPassword({
        email,
        token,
        newPassword,
      });
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);

      throw new InternalServerErrorException('Password reset failed.');
    }
  }
}
