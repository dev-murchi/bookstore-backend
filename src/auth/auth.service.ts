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

import { PrismaService } from '../prisma/prisma.service';
import { MailSenderService } from '../mail-sender/mail-sender.service';
import { PasswordResetDto } from '../user/dto/password-reset.dto';
import { RoleEnum } from '../common/role.enum';

const roundsOfHashing = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
    private readonly prisma: PrismaService,
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
    // get password_reset_tokens
    const passwordResetToken =
      await this.prisma.password_reset_tokens.findUnique({ where: { token } });

    // check token validty
    if (!passwordResetToken) throw new BadRequestException('Invalid token');

    // delete disposable password reset token
    await this.prisma.password_reset_tokens.delete({ where: { token } });

    // check token expiration
    if (passwordResetToken.expires_at < new Date(Date.now())) {
      throw new BadRequestException('Invalid token');
    }

    // get user with email
    const user = await this.userService.findBy(email);

    // check user correctness
    if (!user || user.id !== passwordResetToken.userid)
      throw new BadRequestException('Invalid email');

    // compare new password with old password
    if (await bcrypt.compare(newPassword, user.password)) {
      throw new BadRequestException(
        'New password must be different from the current password. Please try again.',
      );
    }
    // hash password
    const hashedPassword = await bcrypt.hash(newPassword, roundsOfHashing);

    // update user password
    await this.userService.update(user.id, { password: hashedPassword });

    return { message: 'Password reset successfully' };
  }
}
