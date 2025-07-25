import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { HelperService } from 'src/common/helper.service';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'refresh-token',
) {
  constructor(
    readonly configService: ConfigService,
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
      const refreshToken = request.headers['x-refresh-token'] as string;

      if (!refreshToken) {
        throw new UnauthorizedException('Refresh token not found in headers');
      }

      const session = await this.prisma.userSession.findUnique({
        where: {
          userId: payload.id,
          id: payload.sessionId,
        },
        select: {
          refreshToken: true,
          expiresAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: { select: { name: true } },
              cart: true,
              lastPasswordResetAt: true,
            },
          },
        },
      });

      if (!session) {
        throw new UnauthorizedException('Session not found. Please login.');
      }

      const validRefresToken = HelperService.verifyTokenHash(
        refreshToken,
        session.refreshToken,
        'hex',
      );

      if (!validRefresToken) {
        throw new UnauthorizedException('Refresh token is invalid.');
      }

      if (session.user.lastPasswordResetAt > new Date(payload.iat * 1000)) {
        throw new UnauthorizedException(
          'Session expired due to password change. Please log in again.',
        );
      }

      if (session.expiresAt < new Date()) {
        throw new UnauthorizedException(
          'Expired refresh token. Please login again.',
        );
      }

      return {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role.name,
        cartId: session.user.cart?.id ?? null,
        sessionId: payload.sessionId,
      };
    } catch (error) {
      console.error('RefreshTokenStrategy validation failed:', error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Refresh failed.');
    }
  }
}
