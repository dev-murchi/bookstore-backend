import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../common/decorator/role/role.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (!request.user)
      throw new UnauthorizedException('Authentication failed.');

    const role = this.reflector.getAllAndOverride(Role, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (role !== request.user['role']['name'])
      throw new UnauthorizedException('Unauthorized user.');
    return true;
  }
}
