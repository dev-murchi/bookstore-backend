import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../../decorator/role/role.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (!request.user)
      throw new UnauthorizedException('Authentication failed.');

    const roles = this.reflector.getAllAndMerge(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles.includes(request.user['role']['name']))
      throw new UnauthorizedException('Unauthorized user.');
    return true;
  }
}
