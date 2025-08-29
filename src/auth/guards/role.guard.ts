import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Roles } from 'src/common/decorator/role/role.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User authentication failed.');
    }

    const requiredRoles = this.reflector.getAllAndMerge<string[]>(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!requiredRoles.includes(user['role'])) {
      if (user['id']) {
        throw new ForbiddenException(
          'Access denied. Insufficient permissions.',
        );
      }
      // guest user
      throw new UnauthorizedException(
        'User is not authenticated or authorized.',
      );
    }

    return true;
  }
}
