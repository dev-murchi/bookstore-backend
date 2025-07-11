import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RoleEnum } from 'src/common/enum/role.enum';
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
    let guestCartToken = request.headers['x-guest-cart-token'] as string;

    if (!guestCartToken || !guestCartToken.trim()) {
      guestCartToken = null;
    }

    return {
      id: null,
      role: RoleEnum.GuestUser,
      guestCartToken: guestCartToken,
    };
  }
}
