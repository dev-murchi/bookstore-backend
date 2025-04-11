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
import { Request } from 'express';
import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/role.enum';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';

@Controller('checkout')
@UseGuards(UserAccessGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
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
      throw new BadRequestException(error.message);
    }
  }
}
