import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { RoleEnum } from '../../../common/role.enum';
import { Roles } from '../../../common/decorator/role/role.decorator';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { UserService } from '../../../user/user.service';

@Injectable()
export class CartGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
    private jwtService: JwtService,
    private userService: UserService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // get allowed roles
      const roles = this.reflector.getAllAndMerge(Roles, [
        context.getHandler(),
        context.getClass(),
      ]);

      console.log({ roles });

      // fetch authorization token
      const request = context.switchToHttp().getRequest();
      const token = this.extractTokenFromHeader(request);

      console.log({ token });

      if (!token) {
        // guest user
        // check the guest user is allowed or not
        if (!roles.includes(RoleEnum.GuestUser))
          throw new Error('guest user is not allowed');

        request.user = null; // guset user

        return true;
      }

      // get payload from token
      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = await this.jwtService.verifyAsync(token, { secret });

      // fetch the user
      const user = await this.userService.findOne(payload.id);

      if (!user) throw new Error('user not exist');

      const userRole = user.role.role_name as RoleEnum;

      if (!roles.includes(userRole)) throw new Error('user not allowed');

      request.user = {
        id: user.id,
        email: user.email,
        role: user.role.role_name,
        cartId: user.cart ? user.cart.id : null,
      };

      return true;
    } catch (error) {
      console.error(error);

      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException('Token Expired');
      }

      if (error.message === 'guest user is not allowed') {
        throw new UnauthorizedException('Guest is not allowed');
      }

      if (error.message === 'user not exist') {
        throw new UnauthorizedException('User is not exist');
      }

      if (error.message === 'user not allowed') {
        throw new UnauthorizedException('User is not allowed');
      }

      throw new UnauthorizedException('Unauthorized cart operation');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
