import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatusDto } from './dto/order-status.dto';
import { RoleGuard } from '../common/guards/role/role.guard';
import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/role.enum';
import { AuthGuard } from '../common/guards/auth/auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}
  @Post(':id/status')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles([RoleEnum.Admin])
  async updateOrderStatus(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() orderStatusDto: OrderStatusDto,
  ) {
    return await this.service.updateStatus(orderId, orderStatusDto.status);
  }
}
