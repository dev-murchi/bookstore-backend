import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'my-jwt') {
  constructor(
    readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,
      secretOrKey: configService.get('jwt.secret'),
      passReqToCallback: true,
    });
  }
  async validate(request: Request, payload: any) {
    try {
      const accessToken = ExtractJwt.fromAuthHeaderAsBearerToken()(request);

      let isAccessTokenExpired = false;
      try {
        this.jwtService.verify(accessToken, {
          secret: this.configService.get('jwt.secret'),
        });
      } catch (err) {
        console.error(err);
        if (err.name === 'TokenExpiredError') {
          isAccessTokenExpired = true;
        } else {
          throw new UnauthorizedException(
            'Access token is invalid or malformed.',
          );
        }
      }

      const userSession = await this.prisma.user_session.findUnique({
        where: {
          userid: payload.id,
          id: payload.sessionId,
        },
        select: {
          refresh_token: true,
          refresh_required: true,
          expires_at: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: { select: { role_name: true } },
              cart: true,
              password: true,
              last_password_reset_at: true,
            },
          },
        },
      });

      if (!userSession) {
        throw new UnauthorizedException(
          'User session id not found. Please login',
        );
      }

      if (
        userSession.user.last_password_reset_at > new Date(payload.iat * 1000)
      ) {
        throw new UnauthorizedException(
          'Session expired due to password change. Please log in again.',
        );
      }

      let tokenRefreshRequired = false;
      if (isAccessTokenExpired) {
        if (userSession.expires_at < new Date()) {
          throw new UnauthorizedException('Expired token. Please login.');
        }

        if (userSession.refresh_required) {
          throw new UnauthorizedException(
            'Expired token. Please refresh your token.',
          );
        }

        await this.prisma.user_session.update({
          where: {
            userid: payload.id,
            id: payload.sessionId,
          },
          data: {
            refresh_required: true,
          },
        });
        tokenRefreshRequired = true;
      }

      return {
        id: userSession.user.id,
        name: userSession.user.name,
        email: userSession.user.email,
        role: userSession.user.role.role_name,
        cartId: userSession.user.cart?.id ?? null,
        sessionId: payload.sessionId,
        password: userSession.user.password,
        tokenRefreshRequired,
      };
    } catch (error) {
      console.error('JwtStrategy validation failed. Error:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed.');
    }
  }
}
