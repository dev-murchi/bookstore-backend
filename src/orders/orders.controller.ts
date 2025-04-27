import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/role.enum';
import { Request } from 'express';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { Queue } from 'bullmq';
import { OrderStatusDto } from './dto/order-status.dto';
import { OrdersStatusService } from './orders-status.service';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(UserAccessGuard)
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private ordersStatusService: OrdersStatusService,
  ) {}

  @Post(':id/status')
  @Roles([RoleEnum.Admin])
  async updateOrderStatus(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() orderStatusDTO: OrderStatusDto,
  ) {
    try {
      let order;
      switch (orderStatusDTO.status) {
        case 'delivered':
          order = await this.ordersStatusService.deliverOrder(orderId);
          break;
        case 'shipped':
          order = await this.ordersStatusService.shipOrder(orderId);
          break;
        case 'canceled':
          order = await this.ordersStatusService.cancelOrder(orderId);
          break;
        default:
          throw new Error('Invalid order status.');
      }
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  @Roles([RoleEnum.Admin, RoleEnum.User])
  async viewAllOrders(@Req() request: Request) {
    try {
      if (request.user['role'] === RoleEnum.User) {
        // user's orders
        return await this.ordersService.getAll(request.user['id']);
      }
      // all orders
      return await this.ordersService.getAll();
    } catch (error) {
      console.error('Orders could not be fetched', error);
      throw new HttpException(
        'Something went wrong!',
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: error },
      );
    }
  }

  @Get(':id')
  @Roles([RoleEnum.Admin, RoleEnum.User])
  async viewOrder(
    @Req() request: Request,
    @Param('id', ParseIntPipe) orderId: number,
  ) {
    try {
      const order = await this.ordersService.getOrder(orderId);

      if (
        request.user['role'] === RoleEnum.User &&
        request.user['id'] !== order.userid
      ) {
        throw new Error('Unauthorized access');
      }

      // admnin or the user who has the order can fetch it
      return order;
    } catch (error) {
      console.error(`Order #${orderId} could not be fetched`, error);
      throw new BadRequestException(`Order #${orderId} could not be fetched`);
    }
  }

  // orderRefund() {}
}
