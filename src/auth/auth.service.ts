import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';

import * as bcrypt from 'bcrypt';
import { LoginDto } from '../user/dto/login.dto';
import { JwtService } from '@nestjs/jwt';

import { MailSenderService } from '../mail-sender/mail-sender.service';
import { PasswordResetDto } from '../user/dto/password-reset.dto';
import { RoleEnum } from '../common/role.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
    private MailSenderService: MailSenderService,
  ) {}

  async register(user: CreateUserDto, role: RoleEnum) {
    return await this.userService.create(user, role);
  }

  async login({ email, password }: LoginDto) {
    // check user existence
    const user = await this.userService.findBy(email);
    if (!user) throw new UnauthorizedException('Invalid user credentials');

    // compare password
    if (!(await bcrypt.compare(password, user.password)))
      throw new UnauthorizedException('Invalid user credentials');

    // generate jwt token
    const payload = {
      id: user.id,
      role: user.role.role_name,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken };
  }

  async forgotPassword(email: string) {
    try {
      const user = await this.userService.findBy(email);

      if (user) {
        const resetToken = await this.userService.createPasswordResetToken(
          user.id,
        );

        // send password reset mail
        const link = `http://localhost/reset-password?token=${resetToken}`;

        await this.MailSenderService.sendResetPasswordMail(
          user.email,
          user.name,
          link,
        );
      }

      return {
        message: 'Please check your email for reset password link.',
      };
    } catch (error) {
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  async resetPassword({ email, token, newPassword }: PasswordResetDto) {
    try {
      return await this.userService.resetPassword(email, token, newPassword);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
