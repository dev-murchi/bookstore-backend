import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RoleEnum } from '../../common/enum/role.enum';
import { Request } from 'express';

@Injectable()
export class CartGuard extends AuthGuard('my-jwt') {
  constructor() {
    super();
  }
  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any,
  ) {
    if (err) throw err;

    if (user) {
      return { ...user, guestCartToken: null };
    }

    const request = context.switchToHttp().getRequest<Request>();
    const guestCartToken = request.headers['x-guest-cart-token'] as string;

    if (!guestCartToken || !guestCartToken.trim()) {
      throw new UnauthorizedException('Missing guest cart token');
    }

    return {
      id: null,
      role: RoleEnum.GuestUser,
      guestCartToken: guestCartToken,
    };
  }
}
