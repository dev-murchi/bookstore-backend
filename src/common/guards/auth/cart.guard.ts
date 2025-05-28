import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RoleEnum } from '../../../common/enum/role.enum';

@Injectable()
export class CartGuard extends AuthGuard('my-jwt') {
  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any,
  ) {
    if (err) throw err;
    if (!user) {
      return {
        id: null,
        role: RoleEnum.GuestUser,
      };
    }
    return user;
  }
}
