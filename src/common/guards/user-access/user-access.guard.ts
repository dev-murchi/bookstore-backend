import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Roles } from '../../decorator/role/role.decorator';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { RoleEnum } from '../../enum/role.enum';

@Injectable()
export class UserAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
    private jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // get all roles required for this route
      const roles = this.reflector.getAllAndMerge(Roles, [
        context.getHandler(),
        context.getClass(),
      ]);

      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromHeader(request);

      // if no token is provided, assume the user is a guest
      if (!token) {
        // allow access only if GuestUser is explicitly allowed
        if (roles.includes(RoleEnum.GuestUser)) {
          return true;
        }
        // otherwise, deny access
        throw new Error('Unauthorized access.');
      }

      // if token is provided, we need to verify and authenticate the user

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync(token, { secret });

      const user = await this.prisma.user.findUnique({
        where: { userid: payload.id },
        select: {
          id: true,
          userid: true,
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

      const userRole = user.role.role_name as RoleEnum;

      if (!roles.includes(userRole)) throw new Error('Access denied.');

      request.user = {
        id: user.userid,
        name: user.name,
        email: user.email,
        role: user.role.role_name,
        cartId: user.cart ? user.cart.id : null,
      };

      return true;
    } catch (error) {
      console.error(error);

      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException(
          'Token has expired. Please log in again.',
        );
      }

      if (error.message === 'Unauthorized access.') {
        throw new UnauthorizedException(
          'You are not authorized to perform this operation.',
        );
      }

      if (error.message === 'User authentication failed.') {
        throw new UnauthorizedException(
          'User authentication failed. Please log in again.',
        );
      }

      if (error.message === 'Access denied.') {
        throw new UnauthorizedException(
          'You do not have permission to access this resource.',
        );
      }

      throw new UnauthorizedException(
        'Unauthorized operation. Please check your credentials and try again.',
      );
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
