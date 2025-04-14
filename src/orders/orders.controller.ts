import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatusDto } from './dto/order-status.dto';
import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/role.enum';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}
  @Post(':id/status')
  @UseGuards(UserAccessGuard)
  @Roles([RoleEnum.Admin])
  async updateOrderStatus(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() orderStatusDto: OrderStatusDto,
  ) {
    try {
      return await this.service.updateStatus(orderId, orderStatusDto.status);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
