import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    const secret = this.configService.get<string>('JWT_SECRET');

    if (!token)
      throw new UnauthorizedException(
        'Please provide a token in correct format.',
      );

    try {
      const payload = await this.jwtService.verifyAsync(token, { secret });

      // get user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          name: true,
          email: true,
          password: true,
          role: {
            select: {
              id: true,
              role_name: true,
            },
          },
          is_active: true,
          cart: true,
        },
      });

      if (!user) throw Error('User authentication failed.');

      // attach user to the request object
      request.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        password: user.password,
        role: {
          id: user.role.id,
          name: user.role.role_name,
        },
        cartId: user.cart ? user.cart.id : null,
      };

      return true;
    } catch (error) {
      console.error('Authentication error: ', error);
      throw new UnauthorizedException('Unauthorized');
    }
  }
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
