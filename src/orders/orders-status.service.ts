import { Injectable } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus } from '../common/enum/order-status.enum';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { Order } from '../common/types';

interface StatusRule {
  from: OrderStatus;
  to: OrderStatus;
}

@Injectable()
export class OrdersStatusService {
  constructor(private readonly ordersService: OrdersService) {}

  private async changeStatus(
    orderId: string,
    rule: StatusRule,
  ): Promise<Order> {
    try {
      const order = await this.ordersService.getOrder(orderId);

      if (!order) throw new CustomAPIError('Please provide a valid order id.');

      if (order.status === rule.to) return order;
      if (order.status !== rule.from)
        throw new CustomAPIError(
          `Order must be in '${rule.from}' status to change to '${rule.to}'. Current: '${order.status}'`,
        );

      const updatedOrder = await this.ordersService.updateStatus(
        orderId,
        rule.to,
      );

      return updatedOrder;
    } catch (error) {
      console.error(
        `Unable to complete order ${rule.to} process: Error`,
        error,
      );
      if (error instanceof CustomAPIError) throw error;
      throw new Error(`Unable to complete order ${rule.to} process.`);
    }
  }

  async cancelOrder(orderId: string): Promise<Order> {
    return await this.changeStatus(orderId, {
      from: OrderStatus.Pending,
      to: OrderStatus.Canceled,
    });
  }

  async shipOrder(orderId: string): Promise<Order> {
    return await this.changeStatus(orderId, {
      from: OrderStatus.Complete,
      to: OrderStatus.Shipped,
    });
  }

  async deliverOrder(orderId: string): Promise<Order> {
    return await this.changeStatus(orderId, {
      from: OrderStatus.Shipped,
      to: OrderStatus.Delivered,
    });
  }
}
