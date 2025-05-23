import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { LoginDto } from '../common/dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';
import { PasswordResetDto } from '../common/dto/password-reset.dto';
import { RoleEnum } from '../common/role.enum';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { SignupDTO } from '../common/dto/signup.dto';
import { UserDTO } from 'src/common/dto/user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(signupDto: SignupDTO, role: RoleEnum): Promise<UserDTO> {
    const data = {
      email: signupDto.email,
      name: signupDto.name,
      password: signupDto.password,
      role: role,
    };
    return await this.userService.create(data);
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
        role: user.role,
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
