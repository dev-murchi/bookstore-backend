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
} from '@nestjs/common';
import { CartService } from './cart.service';
import { DeleteCartItemDto } from './dto/delete-cart-item.dto';
import { CartItemDto } from './dto/cart-item.dto';
import { Request } from 'express';
import { AuthGuard } from '../guard/auth/auth.guard';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  async createCart() {
    return await this.cartService.createCart(null);
  }

  @Get(':id')
  async reviewCart(@Param('id', ParseIntPipe) id: number) {
    return await this.cartService.findCart(id);
  }

  @Post(':id/attach')
  @UseGuards(AuthGuard)
  async attachUser(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request,
  ) {
    return await this.cartService.attachUser(id, request.user['id']);
  }

  @Post('item')
  async addOrUpdateItem(@Body() data: CartItemDto) {
    return await this.cartService.upsertItem(data);
  }

  @Delete('item')
  async removeItem(@Body() data: DeleteCartItemDto) {
    return await this.cartService.removeItem(data);
  }
}
