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
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { DeleteCartItemDto } from './dto/delete-cart-item.dto';
import { CartItemDto } from './dto/cart-item.dto';
import { Request } from 'express';
import { AuthGuard } from '../guard/auth/auth.guard';

@Controller('cart')
@UseGuards(AuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  async createCart(@Req() request: Request) {
    const userId = request.user ? request.user['id'] : null;
    return await this.cartService.createCart(userId);
  }

  @Get(':id')
  async reviewCart(@Param('id', ParseIntPipe) id: number) {
    try {
      return await this.cartService.findCart(id);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/claim')
  async claim(@Param('id', ParseIntPipe) id: number, @Req() request: Request) {
    try {
      if (!request.user) {
        throw new UnauthorizedException(
          'User must be authenticated to claim the cart',
        );
      }

      return await this.cartService.claim(request.user['id'], id);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('item')
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
  async removeItem(@Req() request: Request, @Body() data: DeleteCartItemDto) {
    try {
      if (request.user && request.user['cartId'] === null) {
        throw new Error(
          'Item could not deleted. Please check you have a cart!',
        );
      }
      const userId = request.user ? request.user['id'] : null;

      return await this.cartService.removeItem(userId, data);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
