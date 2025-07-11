import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { LoginDTO } from 'src/common/dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { PasswordResetDTO } from 'src/common/dto/password-reset.dto';
import { RoleEnum } from 'src/common/enum/role.enum';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { SignupDTO } from 'src/common/dto/signup.dto';
import { UserDTO } from 'src/common/dto/user.dto';
import { ConfigService } from '@nestjs/config';
import { HelperService } from 'src/common/helper.service';
import { UserSessionService } from 'src/user/user-session/user-session.service';
import { QueueService } from 'src/queue/queue.service';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  constructor(
    private readonly userService: UserService,
    private jwtService: JwtService,
    private queueService: QueueService,
    private configService: ConfigService,
    private userSessionService: UserSessionService,
  ) {
    this.jwtSecret = this.configService.get('jwt.secret');
    this.jwtExpiresIn = this.configService.get('jwt.expiresIn');
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

      const refreshToken = HelperService.generateToken('base64url');
      const tokenHash = HelperService.hashToken(refreshToken, 'hex');

      // generate jwt token
      const userSession = await this.userSessionService.createSession(
        user.id,
        tokenHash,
      );

      const payload = {
        id: user.id,
        role: user.role as RoleEnum,
        sessionId: userSession.id,
      };
      const accessToken = await this.accessToken(payload);

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

      await this.queueService.addAuthMailJob('authPasswordReset', {
        username: user.name,
        email: user.email,
        passwordResetLink: link,
      });
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

  async logout(userId: string, sessionId: string) {
    return await this.userSessionService.deleteSession(userId, sessionId);
  }

  async refreshToken(
    userId: string,
    sessionId: string,
  ): Promise<{ token: string }> {
    try {
      const token = HelperService.generateToken('base64url');
      const tokenHash = HelperService.hashToken(token, 'hex');
      await this.userSessionService.updateSession(userId, sessionId, tokenHash);

      return { token };
    } catch (error) {
      console.error('User session update failed. Error:', error);
      throw new Error('User session update failed');
    }
  }

  async accessToken(payload: {
    id: string;
    role: RoleEnum;
    sessionId: string;
  }) {
    return await this.jwtService.signAsync(payload, {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiresIn,
    });
  }
}
