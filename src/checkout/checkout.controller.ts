import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { AuthGuard } from '../guard/auth/auth.guard';
import { Request } from 'express';

@Controller('checkout')
@UseGuards(AuthGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  async checkout(
    @Req() request: Request,
    @Body() createCheckoutDto: CreateCheckoutDto,
  ) {
    try {
      // guest user can also checkout
      const userId = request.user ? request.user['id'] : null;

      return await this.checkoutService.checkout(userId, createCheckoutDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
