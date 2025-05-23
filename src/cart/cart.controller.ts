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
import { DeleteCartItemDto } from '../common/dto/delete-cart-item.dto';
import { CartItemDto } from '../common/dto/cart-item.dto';
import { Request } from 'express';
import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/role.enum';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { CreateCheckoutDto } from '../common/dto/create-checkout.dto';
import { CheckoutService } from './checkout/checkout.service';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { Cart, CartItem } from '../common/types';

@Controller('cart')
@UseGuards(UserAccessGuard)
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly checkoutService: CheckoutService,
  ) {}

  @Post()
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  async createCart(@Req() request: Request): Promise<Cart> {
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
  ): Promise<any> {
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
  ): Promise<{ data: Cart | null }> {
    try {
      const cart = await this.cartService.findCartById(id);

      // admin access
      if (request.user && request.user['role'] === RoleEnum.Admin) {
        return { data: cart };
      }

      const userId = request.user ? request.user['id'] : null;

      if (!cart || cart.owner !== userId) {
        throw new UnauthorizedException('Unable to access this cart.');
      }

      return { data: cart };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch the cart due to an unexpected error.',
      );
    }
  }

  @Post(':id/claim')
  @Roles([RoleEnum.User])
  async claim(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
  ): Promise<Cart> {
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
  async addOrUpdateItem(
    @Req() request: Request,
    @Body() data: CartItemDto,
  ): Promise<CartItem> {
    try {
      if (request.user && request.user['cartId'] === null) {
        throw new BadRequestException('Please create a cart.');
      }

      const userId = request.user ? request.user['id'] : null;

      const cart = await this.cartService.findCartById(data.cartId);
      if (!cart) {
        throw new UnauthorizedException('Unable to access this cart1.');
      }

      if (cart.owner !== userId) {
        throw new UnauthorizedException('Unable to access this cart.');
      }

      return await this.cartService.upsertItem(data);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof CustomAPIError) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException(
        'Failed to add the item to the cart due to an unexpected error.',
      );
    }
  }

  @Delete('item')
  @Roles([RoleEnum.User, RoleEnum.GuestUser])
  async removeItem(
    @Req() request: Request,
    @Body() data: DeleteCartItemDto,
  ): Promise<{ message: string }> {
    try {
      if (request.user && request.user['cartId'] === null) {
        throw new BadRequestException(
          'Item could not deleted. Please be sure you have a cart!',
        );
      }

      const userId = request.user ? request.user['id'] : null;

      const cart = await this.cartService.findCartById(data.cartId);

      if (!cart || cart.owner !== userId) {
        throw new Error('Unable to access this cart.');
      }

      if (cart.items.length === 0) {
        throw new BadRequestException('Cart is empty!');
      }

      return await this.cartService.removeItem(data);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'Failed to delete the cart due to an unexpected error.',
      );
    }
  }

  @Post('clear')
  @Roles([RoleEnum.Admin])
  removeInactiveGuestCarts(): Promise<{ removed: number }> {
    try {
      return this.cartService.removeInactiveGuestCarts();
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to remove inactive guest carts due to an unexpected error.',
      );
    }
  }
}
