import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
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

import { Roles } from 'src/common/decorator/role/role.decorator';
import { RoleEnum } from 'src/common/enum/role.enum';
import { Request } from 'express';
import { OrderStatusDTO } from 'src/common/dto/order-status.dto';
import { OrdersStatusService } from './orders-status.service';
import { OrdersService } from './orders.service';
import { OrderDTO } from 'src/common/dto/order.dto';
import { OrderStatus } from 'src/common/enum/order-status.enum';
import { StripeService } from 'src/payment/stripe/stripe.service';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RoleGuard } from 'src/auth/guards/role.guard';
import { OrderEmailTemplateKey } from 'src/common/types/email-config.type';
import { QueueService } from 'src/queue/queue.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RoleGuard)
@ApiTags('Orders')
@ApiBearerAuth()
export class OrdersController {
  private orderStatusToEmailTemplateMap = new Map<
    OrderStatus,
    OrderEmailTemplateKey
  >([
    [OrderStatus.Delivered, 'orderDelivered'],
    [OrderStatus.Shipped, 'orderShipped'],
    [OrderStatus.Canceled, 'orderCanceled'],
  ]);

  constructor(
    private ordersService: OrdersService,
    private ordersStatusService: OrdersStatusService,
    private readonly queueService: QueueService,
    private readonly stripeService: StripeService,
  ) {}

  @Post(':id/status')
  @Roles([RoleEnum.Admin])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update order status (Admin only)',
    description:
      "Allows admin users to update the status of an order to 'delivered', 'shipped', or 'canceled'. When the status is updated successfully, an email notification is sent to the customer's email address.",
  })
  @ApiOkResponse({
    description:
      'Order status updated successfully and email notification sent to customer.',
    type: OrderDTO,
  })
  @ApiBadRequestResponse({
    description: 'Invalid status value or failed to update the order',
  })
  async updateOrderStatus(
    @Param('id', ParseUUIDPipe) orderId: string,
    @Body() orderStatusDTO: OrderStatusDTO,
  ): Promise<OrderDTO> {
    try {
      let order: OrderDTO;

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

      const emailTemplateKey = this.orderStatusToEmailTemplateMap.get(
        orderStatusDTO.status,
      );

      if (emailTemplateKey) {
        await this.queueService.addOrderMailJob(emailTemplateKey, {
          orderId,
          email: order.owner.email,
          username: order.owner.name,
        });
      } else {
        console.warn(
          `No email template found for order status '${orderStatusDTO.status}', email notification not sent.`,
        );
      }

      return order;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  @Roles([RoleEnum.Admin, RoleEnum.User])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'View all orders',
    description:
      'Admins can view all orders in the system. Regular users can only view their own order history.',
  })
  @ApiOkResponse({
    description: 'Orders retrieved',
    type: [OrderDTO],
  })
  @ApiInternalServerErrorResponse({
    description: 'Failed to retrieve orders',
  })
  async viewAllOrders(@Req() request: Request): Promise<OrderDTO[]> {
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'View specific order',
    description:
      'Retrieves details of a specific order. Only the order owner or an admin can access the order.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique identifier of the order to retrieve',
    type: String,
  })
  @ApiOkResponse({
    description: 'Order details retrieved.',
    schema: {
      properties: {
        data: {
          type: 'object',
          $ref: getSchemaPath(OrderDTO),
        },
      },
    },
    examples: {
      pendingOrder: {
        summary: 'Pending order',
        value: {
          data: {
            id: 'a1b2c3d4-e5f6-7890-abcd-123456789abc',
            owner: 'abcdef01-2345-6789-abcd-ef0123456789',
            items: [
              {
                quantity: 2,
                item: {
                  id: 'a1b2c3d4-e5f6-4890-ab12-cd34ef56ab78',
                  title: "Wanderlust: A Traveler's Guide to the World",
                  description:
                    "Explore the world's most breathtaking destinations.",
                  isbn: '978-0451526342',
                  author: {
                    name: 'Bilbo Baggins',
                  },
                  category: {
                    id: 3,
                    value: 'Travel',
                  },
                  price: 19.99,
                  rating: 4.5,
                  imageUrl:
                    'https://example.com/images/wanderlust-book-cover.jpg',
                },
              },
            ],
            status: 'pending',
            price: 39.98,
            shipping: {},
            payment: {},
          },
        },
      },
      completedOrder: {
        summary: 'Completed order',
        value: {
          data: {
            id: 'a1b2c3d4-e5f6-7890-abcd-123456789abc',
            owner: 'abcdef01-2345-6789-abcd-ef0123456789',
            items: [
              {
                quantity: 2,
                item: {
                  id: 'a1b2c3d4-e5f6-4890-ab12-cd34ef56ab78',
                  title: "Wanderlust: A Traveler's Guide to the World",
                  description:
                    "Explore the world's most breathtaking destinations.",
                  isbn: '978-0451526342',
                  author: {
                    name: 'Bilbo Baggins',
                  },
                  category: {
                    id: 3,
                    value: 'Travel',
                  },
                  price: 19.99,
                  rating: 4.5,
                  imageUrl:
                    'https://example.com/images/wanderlust-book-cover.jpg',
                },
              },
            ],
            status: 'completed',
            price: 39.98,
            shipping: {
              email: 'nazgul@bookstore.com',
              phone: '999-009-0009',
              address: {
                country: 'Mordor',
                state: 'Barad-dur',
                city: 'Udun',
                line1: 'The Dark Tower of Barad-dur',
                line2: 'Overlooking the Plains of Gorgoroth',
                postalCode: '000009',
              },
            },
            payment: {
              transactionId: 'tx123abc456',
              status: 'completed',
              method: 'credit card',
              amount: 100.5,
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid order ID or unauthorized access.',
  })
  async viewOrder(
    @Req() request: Request,
    @Param('id', ParseUUIDPipe) orderId: string,
  ): Promise<{ data: OrderDTO }> {
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
  @ApiOperation({
    summary: 'Process a refund (Admin only)',
    description:
      'Initiates a Stripe refund for a completed or delivered order. Only admins are authorized to perform this operation.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique identifier of the order to refund',
    type: String,
  })
  @ApiOkResponse({
    description: 'Refund processed successfully.',
    schema: {
      example: {
        status: 'success',
        message: 'Refund processed successfully.',
        refund: {
          refund_id: 're_1Hh1l2J9X5Z9yZ',
          orderId: 'a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6',
          amount: 49.99,
          currency: 'USD',
          refundedAt: '2025-05-24T12:00:00Z',
          status: 'succeeded',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Refund not allowed. Order must be in "complete" or "delivered" status.',
  })
  @ApiNotFoundResponse({
    description: 'Order not found.',
  })
  @ApiInternalServerErrorResponse({
    description:
      'Failed to process refund due to a Stripe error or server issue.',
  })
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
          orderId,
          amount: Number((refund.amount / 100).toFixed(2)),
          currency: refund.currency.toUpperCase(),
          refundedAt: new Date(refund.created * 1000).toISOString(),
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
