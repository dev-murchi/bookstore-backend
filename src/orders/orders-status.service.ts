import { Inject, Injectable } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { orders } from '@prisma/client';
import { Queue } from 'bullmq';

type OrderStatus = orders['status'];

interface StatusRule {
  from: OrderStatus;
  to: OrderStatus;
  validate?: (order: orders & any) => Promise<void> | void; // 'any' to include joins like order_items
  postUpdate?: (order: orders & any) => Promise<void> | void;
}

@Injectable()
export class OrdersStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    @Inject('MailSenderQueue') private readonly mailSenderQueue: Queue,
  ) {}

  async changeStatus(orderId: number, rule: StatusRule) {
    const order = await this.ordersService.getOrder(orderId);

    if (order.status === rule.to) return order;
    if (order.status !== rule.from)
      throw new Error(
        `Order must be in '${rule.from}' status to change to '${rule.to}'. Current: '${order.status}'`,
      );

    if (rule.validate) await rule.validate(order);

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
        from: 'pending',
        to: 'canceled',
        postUpdate: async (order) => {
          for (const item of order.order_items) {
            await this.prisma.books.update({
              where: { id: item.book.id },
              data: { stock_quantity: { increment: item.quantity } },
            });
          }

          // send order staus update mail to the user
          await this.mailSenderQueue.add('order-status-mail', {
            orderId,
            email: order.shipping_details.email,
            status: order.status,
          });
        },
      });
    });
  }

  async shipOrder(orderId: number) {
    return this.changeStatus(orderId, {
      from: 'complete',
      to: 'shipped',
      postUpdate: async (order) => {
        // send order staus update mail to the user
        await this.mailSenderQueue.add('order-status-mail', {
          orderId,
          email: order.shipping_details.email,
          status: order.status,
        });
      },
    });
  }

  async deliverOrder(orderId: number) {
    return this.changeStatus(orderId, {
      from: 'shipped',
      to: 'delivered',
      postUpdate: async (order) => {
        // send order staus update mail to the user
        await this.mailSenderQueue.add('order-status-mail', {
          orderId,
          email: order.shipping_details.email,
          status: order.status,
        });
      },
    });
  }
}
