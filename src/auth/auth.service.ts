import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';
import { PasswordResetDto } from './dto/password-reset.dto';
import { RoleEnum } from '../common/role.enum';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { User } from '../common/types';
import { SignupDTO } from './dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(signupDto: SignupDTO, role: RoleEnum): Promise<User> {
    const user = new CreateUserDto();
    user.email = signupDto.email;
    user.name = signupDto.name;
    user.password = signupDto.password;
    return await this.userService.create(user, role);
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string }> {
    try {
      const { email, password } = loginDto;
      const user = await this.userService.checkUserWithPassword(
        email,
        password,
      );

      // generate jwt token
      const payload = {
        id: user.id,
        role: user.role.value,
      };
      const accessToken = await this.jwtService.signAsync(payload);
      return { accessToken };
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new UnauthorizedException(error.message);

      throw error;
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);

    if (user) {
      const resetToken = await this.userService.createPasswordResetToken(
        user.id,
      );

      // send password reset mail
      const link = `http://localhost/reset-password?token=${resetToken.token}`;

      await this.emailService.sendResetPasswordMail(
        user.email,
        user.name,
        link,
      );
    }

    return {
      message: 'Please check your email for reset password link.',
    };
  }

  async resetPassword(
    passwordResetDto: PasswordResetDto,
  ): Promise<{ message: string }> {
    const { email, token, newPassword } = passwordResetDto;
    return await this.userService.resetPassword(email, token, newPassword);
  }
}
