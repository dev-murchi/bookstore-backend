import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { Request } from 'express';
import { DeleteCartItemDto } from './dto/delete-cart-item.dto';
import { CartItemDto } from './dto/cart-item.dto';
import { AuthGuard } from '../guard/auth/auth.guard';

@Controller('cart')
@UseGuards(AuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  async createCart(@Req() request: Request) {
    if (request.user['cartId']) return { cartId: request.user['cartId'] };
    return await this.cartService.createCart(request.user['id']);
  }

  @Get()
  async getCart(@Req() request: Request) {
    if (!request.user['cartId'])
      throw new BadRequestException('You do not have cart.');
    return await this.cartService.findCart(request.user['cartId']);
  }

  @Post('item')
  async addOrUpdateItem(@Req() request: Request, @Body() data: CartItemDto) {
    if (!request.user['cartId'])
      throw new BadRequestException('You do not have cart.');
    return await this.cartService.upsertItem(request.user['cartId'], data);
  }

  @Post('item/list')
  async updateItem(@Req() request: Request, @Body() data: CartItemDto[]) {
    if (!request.user['cartId'])
      throw new BadRequestException('You do not have cart.');
    return await this.cartService.upsertItems(request.user['cartId'], data);
  }

  @Delete('item')
  async removeItem(@Req() request: Request, @Body() data: DeleteCartItemDto) {
    if (!request.user['cartId'])
      throw new BadRequestException('You do not have cart.');

    return await this.cartService.removeItem(request.user['cartId'], data);
  }

  @Delete('item/list')
  async removeItems(
    @Req() request: Request,
    @Body() data: DeleteCartItemDto[],
  ) {
    if (!request.user['cartId'])
      throw new BadRequestException('You do not have cart.');

    return await this.cartService.removeItems(request.user['cartId'], data);
  }
}
