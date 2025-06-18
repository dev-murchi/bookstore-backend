import { AuthGuard } from '@nestjs/passport';
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class RefreshGuard extends AuthGuard('refresh-token') {
  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any,
  ) {
    if (err) throw err;
    if (!user) {
      throw new UnauthorizedException(
        'User not found or refresh token is invalid.',
      );
    }
    return user;
  }
}
