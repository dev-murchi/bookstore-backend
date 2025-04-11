import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { DeleteCartItemDto } from './dto/delete-cart-item.dto';
import { CartItemDto } from './dto/cart-item.dto';
import { Request } from 'express';
import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/role.enum';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';

@Controller('cart')
@UseGuards(UserAccessGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  async createCart(@Req() request: Request) {
    const userId = request.user ? request.user['id'] : null;
    return await this.cartService.createCart(userId);
  }

  @Get(':id')
  @Roles([RoleEnum.Admin, RoleEnum.User, RoleEnum.GuestUser])
  async reviewCart(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
  ) {
    try {
      const cart = await this.cartService.findCart(id);

      // guest user access
      if (!request.user) {
        if (cart.userId !== null) {
          throw new Error('Unable to access this cart.');
        }
        return cart;
      }

      // admin access
      if (request.user['role'] === RoleEnum.Admin) return cart;

      // authenticated user access
      if (cart.userId != request.user['id'])
        throw new Error('Unable to access this cart.');

      return cart;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/claim')
  @Roles([RoleEnum.User])
  async claim(@Param('id', ParseIntPipe) id: number, @Req() request: Request) {
    try {
      return await this.cartService.claim(request.user['id'], id);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('item')
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  async addOrUpdateItem(@Req() request: Request, @Body() data: CartItemDto) {
    try {
      if (request.user && request.user['cartId'] === null) {
        throw new Error('Please create a cart.');
      }

      const userId = request.user ? request.user['id'] : null;

      return await this.cartService.upsertItem(userId, data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Delete('item')
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  async removeItem(@Req() request: Request, @Body() data: DeleteCartItemDto) {
    try {
      if (request.user && request.user['cartId'] === null) {
        throw new Error(
          'Item could not deleted. Please be sure you have a cart!',
        );
      }
      const userId = request.user ? request.user['id'] : null;

      return await this.cartService.removeItem(userId, data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
