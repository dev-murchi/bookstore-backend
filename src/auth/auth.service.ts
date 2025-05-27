import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { LoginDTO } from '../common/dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';
import { PasswordResetDTO } from '../common/dto/password-reset.dto';
import { RoleEnum } from '../common/enum/role.enum';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { SignupDTO } from '../common/dto/signup.dto';
import { UserDTO } from 'src/common/dto/user.dto';
import { ConfigService } from '@nestjs/config';
import { HelperService } from 'src/common/helper.service';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefresh: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get('jwt.secret');
    this.jwtExpiresIn = this.configService.get('jwt.expiresIn');
    this.jwtRefresh = this.configService.get('jwt.refreshSecret');
    this.jwtRefreshExpiresIn = this.configService.get('jwt.refreshExpiresIn');
  }

  async register(signupDto: SignupDTO, role: RoleEnum): Promise<UserDTO> {
    const data = {
      email: signupDto.email,
      name: signupDto.name,
      password: signupDto.password,
      role: role,
    };
    return await this.userService.create(data);
  }

  async login(
    loginDto: LoginDTO,
  ): Promise<{ accessToken: string; refreshToken: string }> {
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
      const accessToken = await this.jwtService.signAsync(payload, {
        secret: this.jwtSecret,
        expiresIn: this.jwtExpiresIn,
      });

      const refreshToken = Buffer.from(
        HelperService.generateUUID(),
        'utf-8',
      ).toString('base64');

      return { accessToken, refreshToken };
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
    passwordResetDto: PasswordResetDTO,
  ): Promise<{ message: string }> {
    const { email, token, newPassword } = passwordResetDto;
    return await this.userService.resetPassword(email, token, newPassword);
  }
}
