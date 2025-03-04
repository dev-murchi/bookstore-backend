import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Role } from '../../decorator/role/role.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    if (!request.user)
      throw new UnauthorizedException('Authentication failed.');

    const role = this.reflector.getAllAndOverride(Role, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (role !== request.user['role']['name'])
      throw new UnauthorizedException('Unauthorized user');
    return true;
  }
}
