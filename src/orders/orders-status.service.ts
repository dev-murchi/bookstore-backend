import { Injectable } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { orders } from '@prisma/client';
import { OrderStatus } from './enum/order-status.enum';
import { EmailService } from '../email/email.service';

interface StatusRule {
  from: OrderStatus;
  to: OrderStatus;
  postUpdate?: (order: orders & any) => Promise<void> | void;
}

@Injectable()
export class OrdersStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly emailService: EmailService,
  ) {}

  async changeStatus(orderId: number, rule: StatusRule) {
    const order = await this.ordersService.getOrder(orderId);

    if (order.status === rule.to) return order;
    if (order.status !== rule.from)
      throw new Error(
        `Order must be in '${rule.from}' status to change to '${rule.to}'. Current: '${order.status}'`,
      );

    const updatedOrder = await this.ordersService.updateStatus(
      orderId,
      rule.to,
    );

    if (rule.postUpdate) await rule.postUpdate(updatedOrder);

    return updatedOrder;
  }

  async cancelOrder(orderId: number) {
    return this.prisma.$transaction(async () => {
      return this.changeStatus(orderId, {
        from: OrderStatus.Pending,
        to: OrderStatus.Canceled,
        postUpdate: async (order) => {
          for (const item of order.order_items) {
            await this.prisma.books.update({
              where: { id: item.book.id },
              data: { stock_quantity: { increment: item.quantity } },
            });
          }

          // send order staus update mail to the user
          await this.emailService.sendOrderStatusUpdate(
            orderId,
            order.status,
            order.shipping_details.email,
          );
        },
      });
    });
  }

  async shipOrder(orderId: number) {
    return this.changeStatus(orderId, {
      from: OrderStatus.Complete,
      to: OrderStatus.Shipped,
      postUpdate: async (order) => {
        // send order staus update mail to the user
        await this.emailService.sendOrderStatusUpdate(
          orderId,
          order.status,
          order.shipping_details.email,
        );
      },
    });
  }

  async deliverOrder(orderId: number) {
    return this.changeStatus(orderId, {
      from: OrderStatus.Shipped,
      to: OrderStatus.Delivered,
      postUpdate: async (order) => {
        // send order staus update mail to the user
        await this.emailService.sendOrderStatusUpdate(
          orderId,
          order.status,
          order.shipping_details.email,
        );
      },
    });
  }
}
