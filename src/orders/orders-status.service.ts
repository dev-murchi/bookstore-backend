import { Injectable } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { orders } from '@prisma/client';
import { OrderStatus } from './enum/order-status.enum';

interface StatusRule {
  from: OrderStatus;
  to: OrderStatus;
  postUpdate?: (order: orders & any) => Promise<void> | void;
}

@Injectable()
export class OrdersStatusService {
  constructor(private readonly ordersService: OrdersService) {}

  private async changeStatus(orderId: number, rule: StatusRule) {
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

    return updatedOrder;
  }

  async cancelOrder(orderId: number) {
    try {
      return await this.changeStatus(orderId, {
        from: OrderStatus.Pending,
        to: OrderStatus.Canceled,
      });
    } catch (error) {
      console.error(`Unable to complete order canceling process: Error`, error);
      throw new Error(`Unable to complete order canceling process`);
    }
  }

  async shipOrder(orderId: number) {
    try {
      return await this.changeStatus(orderId, {
        from: OrderStatus.Complete,
        to: OrderStatus.Shipped,
      });
    } catch (error) {
      console.error(`Unable to complete order shipping process: Error`, error);
      throw new Error(`Unable to complete order shipping process`);
    }
  }

  async deliverOrder(orderId: number) {
    try {
      return await this.changeStatus(orderId, {
        from: OrderStatus.Shipped,
        to: OrderStatus.Delivered,
      });
    } catch (error) {
      console.error(`Unable to complete order delivery process: Error`, error);
      throw new Error(`Unable to complete order delivery process`);
    }
  }
}
