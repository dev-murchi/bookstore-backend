import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginDto } from '../user/dto/login.dto';

@Controller('/api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() user: CreateUserDto) {
    return await this.authService.register(user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() { email, password }: LoginDto) {
    return await this.authService.login({ email, password });
  }
}
