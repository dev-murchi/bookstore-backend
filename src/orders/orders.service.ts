import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(userId?: number) {
    try {
      const where: Prisma.ordersWhereInput = {};

      if (userId) {
        where['user'] = { id: userId };
      }

      return await this.prisma.orders.findMany({
        where,
        select: {
          id: true,
          userid: true,
          totalPrice: true,
          status: true,
          shipping_details: { select: { email: true } },
          order_items: {
            select: {
              id: true,
              book: {
                select: {
                  id: true,
                  title: true,
                  author: { select: { name: true } },
                },
              },
              quantity: true,
            },
          },
        },
      });
    } catch (error) {
      console.error('Orders could not fetched', error);
      throw new Error('Orders could not fetched');
    }
  }

  async getOrder(orderId: number) {
    const order = await this.prisma.orders.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        userid: true,
        totalPrice: true,
        status: true,
        shipping_details: { select: { email: true } },
        order_items: {
          select: {
            id: true,
            book: {
              select: {
                id: true,
                title: true,
                author: { select: { name: true } },
              },
            },
            quantity: true,
          },
        },
      },
    });
    if (!order) throw new Error(`Order not found: ${orderId}`);
    return order;
  }

  async updateStatus(orderId: number, status: string) {
    try {
      return await this.prisma.orders.update({
        where: { id: orderId },
        data: { status },
        select: {
          id: true,
          userid: true,
          totalPrice: true,
          status: true,
          shipping_details: { select: { email: true } },
          order_items: {
            select: {
              id: true,
              book: {
                select: {
                  id: true,
                  title: true,
                  author: { select: { name: true } },
                },
              },
              quantity: true,
            },
          },
        },
      });
    } catch (error) {
      console.error(`Order #${orderId} status update failed`, error);
      throw new Error(`Order #${orderId} status could not be updated`);
    }
  }
}
