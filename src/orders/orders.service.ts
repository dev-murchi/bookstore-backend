import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { OrderStatus } from './enum/order-status.enum';
import { Order, OrderItem } from '../common/types';

@Injectable()
export class OrdersService {
  private readonly bookSelect = {
    bookid: true,
    title: true,
    description: true,
    isbn: true,
    price: true,
    rating: true,
    image_url: true,
    author: { select: { name: true } },
    category: { select: { id: true, category_name: true } },
  };

  private readonly addressSelect = {
    country: true,
    state: true,
    city: true,
    line1: true,
    line2: true,
    postalCode: true,
  };

  private readonly paymentSelect = {
    select: {
      transaction_id: true,
      status: true,
      method: true,
      amount: true,
    },
  };

  private readonly shippingSelect = {
    select: {
      email: true,
      phone: true,
      address: {
        select: this.addressSelect,
      },
    },
  };

  private readonly orderItemSelect = {
    select: {
      quantity: true,
      book: {
        select: this.bookSelect,
      },
    },
  };

  private readonly orderSelect = {
    id: true,
    status: true,
    userid: true,
    totalPrice: true,
    order_items: this.orderItemSelect,
    shipping_details: this.shippingSelect,
    payment: this.paymentSelect,
  };

  constructor(private readonly prisma: PrismaService) {}

  async getAll(userId?: number): Promise<Order[]> {
    try {
      const where: Prisma.ordersWhereInput = {};

      if (userId) {
        where['user'] = { id: userId };
      }

      const orders = await this.prisma.orders.findMany({
        where,
        select: this.orderSelect,
      });
      return orders.map((order) => this.transformToOrder(order));
    } catch (error) {
      console.error('Orders could not fetched', error);
      throw new Error('Orders could not fetched');
    }
  }

  async getOrder(orderId: number): Promise<Order | null> {
    const order = await this.prisma.orders.findUnique({
      where: {
        id: orderId,
      },
      select: this.orderSelect,
    });
    if (!order) return null;
    return this.transformToOrder(order);
  }

  async updateStatus(orderId: number, status: OrderStatus): Promise<Order> {
    try {
      const order = await this.prisma.orders.update({
        where: { id: orderId },
        data: { status },
        select: this.orderSelect,
      });
      return this.transformToOrder(order);
    } catch (error) {
      console.error(`Order #${orderId} status update failed`, error);
      throw new Error(`Order #${orderId} status could not be updated`);
    }
  }

  async revertOrderStocks(orderId: number) {
    try {
      const orderItems = await this.prisma.order_items.findMany({
        where: { orderid: orderId },
      });

      await this.prisma.$transaction(async () => {
        for (const item of orderItems) {
          await this.prisma.books.update({
            where: { bookid: item.bookid },
            data: { stock_quantity: { increment: item.quantity } },
          });
        }
      });

      console.log(`Stock reverted successfully for Order ${orderId}`);
    } catch (error) {
      console.error('Error while reverting stock counts:', error);
      throw new Error(
        `Stock counts could not be reverted for Order ${orderId}.`,
      );
    }
  }

  private transformToOrderItem(orderItem: any): OrderItem {
    return {
      quantity: orderItem.quantity,
      item: {
        id: orderItem.book.bookid,
        title: orderItem.book.title,
        description: orderItem.book.description,
        isbn: orderItem.book.isbn,
        price: Number(orderItem.book.price.toFixed(2)),
        rating: Number(orderItem.book.rating.toFixed(2)),
        imageUrl: orderItem.book.image_url,
        author: { name: orderItem.book.author.name },
        category: {
          id: orderItem.book.category.id,
          value: orderItem.book.category.category_name,
        },
      },
    };
  }

  private transformToOrder(order: any): Order {
    const {
      id,
      userid,
      status,
      totalPrice,
      order_items,
      shipping_details,
      payment,
    } = order;

    const items = order_items.map((item) => this.transformToOrderItem(item));

    const shipping = shipping_details
      ? {
          email: shipping_details.email,
          phone: shipping_details.phone,
          address: {
            country: shipping_details.country,
            state: shipping_details.state,
            city: shipping_details.city,
            line1: shipping_details.line1,
            line2: shipping_details.line2,
            postalCode: shipping_details.postalCode,
          },
        }
      : null;

    const paymentInfo = payment
      ? {
          transactionId: payment.transaction_id,
          status: payment.status,
          method: payment.method,
          amount: Number(payment.amount.toFixed(2)),
        }
      : null;

    return {
      id,
      userId: userid,
      status,
      price: Number(totalPrice.toFixed(2)),
      items,
      shipping,
      payment: paymentInfo,
    };
  }
}
