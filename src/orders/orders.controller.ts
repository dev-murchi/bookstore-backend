import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../common/decorator/role/role.decorator';
import { RoleEnum } from '../common/role.enum';
import { Request } from 'express';
import { UserAccessGuard } from '../common/guards/user-access/user-access.guard';
import { OrderStatusDto } from '../common/dto/order-status.dto';
import { OrdersStatusService } from './orders-status.service';
import { OrdersService } from './orders.service';
import { EmailService } from '../email/email.service';
import { Order } from '../common/types';
import { OrderStatus } from '../common/enum/order-status.enum';
import { StripeService } from '../payment/stripe/stripe.service';

@Controller('orders')
@UseGuards(UserAccessGuard)
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private ordersStatusService: OrdersStatusService,
    private readonly emailService: EmailService,
    private readonly stripeService: StripeService,
  ) {}

  @Post(':id/status')
  @Roles([RoleEnum.Admin])
  async updateOrderStatus(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() orderStatusDTO: OrderStatusDto,
  ): Promise<Order> {
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

      await this.emailService.sendOrderStatusUpdate(
        order.orderid,
        order.status,
        order.shipping_details.email,
      );

      return order;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  @Roles([RoleEnum.Admin, RoleEnum.User])
  async viewAllOrders(@Req() request: Request): Promise<Order[]> {
    try {
      if (request.user['role'] === RoleEnum.User) {
        return await this.ordersService.getUserOrders(request.user['id']);
      }
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
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<{ data: Order }> {
    try {
      const order = await this.ordersService.getOrder(orderId);

      if (request.user['role'] === RoleEnum.Admin) return { data: order };

      if (request.user['id'] !== order.owner) {
        throw new Error('Unauthorized access');
      }

      // admnin or the user who has the order can fetch it
      return { data: order };
    } catch (error) {
      console.error(`Order #${orderId} could not be fetched`, error);
      throw new BadRequestException(`Order #${orderId} could not be fetched`);
    }
  }
  @Post(':id/refund')
  @Roles([RoleEnum.Admin])
  async orderRefund(@Param('id', ParseUUIDPipe) orderId: string) {
    try {
      const order = await this.ordersService.getOrder(orderId);

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (
        ![OrderStatus.Complete, OrderStatus.Delivered].includes(
          order.status as OrderStatus,
        )
      ) {
        throw new BadRequestException(
          'Order status must be complete or delivered to process a refund',
        );
      }

      const refund = await this.stripeService.createRefundForPayment(
        order.payment.transactionId,
        { orderId },
      );

      return {
        status: 'success',
        message: 'Refund processed successfully.',
        refund: {
          refund_id: refund.id,
          order_id: orderId,
          amount: Number((refund.amount / 100).toFixed(2)),
          currency: refund.currency.toUpperCase(),
          refunded_at: new Date(refund.created * 1000).toISOString(),
          status: refund.status,
        },
      };
    } catch (error) {
      console.error(error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Refund could not be processed. Please try again later.',
      );
    }
  }
}
