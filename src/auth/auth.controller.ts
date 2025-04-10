import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from '../user/dto/login.dto';
import { PasswordResetRequestDto } from '../user/dto/password-reset-request.dto';
import { PasswordResetDto } from '../user/dto/password-reset.dto';
import { RoleEnum } from '../common/role.enum';
import { AuthGuard } from '../common/guards/auth/auth.guard';
import { RoleGuard } from '../common/guards/role/role.guard';
import { Roles } from '../common/decorator/role/role.decorator';

@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() user: CreateUserDto) {
    return await this.authService.register(user, RoleEnum.User);
  }

  @Post('create-author')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles([RoleEnum.Admin])
  async createAuthor(@Body() user: CreateUserDto) {
    return await this.authService.register(user, RoleEnum.Author);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() { email, password }: LoginDto) {
    return await this.authService.login({ email, password });
  }

  @Post('forgot-password')
  async forgotPassword(@Body() { email }: PasswordResetRequestDto) {
    return await this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() { email, token, newPassword }: PasswordResetDto) {
    return await this.authService.resetPassword({ email, token, newPassword });
  }
}
