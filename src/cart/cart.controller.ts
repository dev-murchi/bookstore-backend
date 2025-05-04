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
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { DeleteCartItemDto } from './dto/delete-cart-item.dto';
import { CartItemDto } from './dto/cart-item.dto';
import { Request } from 'express';
import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/role.enum';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CheckoutService } from './checkout/checkout.service';
import { CustomAPIError } from '../common/errors/custom-api.error';

@Controller('cart')
@UseGuards(UserAccessGuard)
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly checkoutService: CheckoutService,
  ) {}

  @Post()
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  async createCart(@Req() request: Request) {
    try {
      const userId = request.user ? request.user['id'] : null;
      return await this.cartService.createCart(userId);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to create the cart due to an unexpected error.',
      );
    }
  }

  @Post('checkout')
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  async checkout(
    @Req() request: Request,
    @Body() createCheckoutDto: CreateCheckoutDto,
  ) {
    try {
      // guest user can also checkout
      const userId = request.user ? request.user['id'] : null;

      return await this.checkoutService.checkout(userId, createCheckoutDto);
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);
      throw new InternalServerErrorException(
        'Failed to checkout due to an unexpected error.',
      );
    }
  }

  @Get(':id')
  @Roles([RoleEnum.Admin, RoleEnum.User, RoleEnum.GuestUser])
  async viewCart(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
  ) {
    try {
      const cart = await this.cartService.findCart(id);

      // guest user access
      if (!request.user) {
        if (cart.userId !== null) {
          throw new UnauthorizedException('Unable to access this cart.');
        }
        return cart;
      }

      // admin access
      if (request.user['role'] === RoleEnum.Admin) return cart;

      // authenticated user access
      if (cart.userId != request.user['id'])
        throw new UnauthorizedException('Unable to access this cart.');

      return cart;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);
      throw new InternalServerErrorException(
        'Failed to fetch the cart due to an unexpected error.',
      );
    }
  }

  @Post(':id/claim')
  @Roles([RoleEnum.User])
  async claim(@Param('id', ParseIntPipe) id: number, @Req() request: Request) {
    try {
      return await this.cartService.claim(request.user['id'], id);
    } catch (error) {
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);
      throw new InternalServerErrorException(
        'Failed to calim the cart due to an unexpected error.',
      );
    }
  }

  @Post('item')
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  async addOrUpdateItem(@Req() request: Request, @Body() data: CartItemDto) {
    try {
      if (request.user && request.user['cartId'] === null) {
        throw new BadRequestException('Please create a cart.');
      }

      const userId = request.user ? request.user['id'] : null;

      return await this.cartService.upsertItem(userId, data);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof CustomAPIError)
        throw new BadRequestException(error.message);
      throw new InternalServerErrorException(
        'Failed to add the item to the cart due to an unexpected error.',
      );
    }
  }

  @Delete('item')
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  async removeItem(@Req() request: Request, @Body() data: DeleteCartItemDto) {
    try {
      if (request.user && request.user['cartId'] === null) {
        throw new BadRequestException(
          'Item could not deleted. Please be sure you have a cart!',
        );
      }
      const userId = request.user ? request.user['id'] : null;

      return await this.cartService.removeItem(userId, data);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'Failed to delete the cart due to an unexpected error.',
      );
    }
  }

  @Post('clear')
  @Roles([RoleEnum.Admin])
  removeInactiveGuestCarts() {
    try {
      return this.cartService.removeInactiveGuestCarts();
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to remove inactive guest carts due to an unexpected error.',
      );
    }
  }
}
