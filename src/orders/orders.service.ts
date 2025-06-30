import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { OrderStatus } from '../common/enum/order-status.enum';
import { OrderItemDTO } from '../common/dto/order-item.dto';
import { BookDTO } from '../common/dto/book.dto';
import { CategoryDTO } from '../common/dto/category.dto';
import { OrderDTO } from '../common/dto/order.dto';
import { AddressDTO } from '../common/dto/address.dto';
import { ShippingDTO } from '../common/dto/shipping.dto';
import { PaymentDTO } from '../common/dto/payment.dto';
import { validate } from 'class-validator';
import { OrderOwnerDTO } from '../common/dto/order-owner.dto';

@Injectable()
export class OrdersService {
  private readonly bookSelect = {
    id: true,
    title: true,
    description: true,
    isbn: true,
    price: true,
    rating: true,
    imageUrl: true,
    author: { select: { name: true } },
    category: { select: { id: true, name: true } },
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
      id: true,
      transactionId: true,
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
    user: { select: { id: true, name: true, email: true } },
    guestName: true,
    guestEmail: true,
    totalPrice: true,
    orderItems: this.orderItemSelect,
    shippingDetails: this.shippingSelect,
    payment: this.paymentSelect,
  };

  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<OrderDTO[]> {
    return await this.getOrders({});
  }

  async getUserOrders(userId: string): Promise<OrderDTO[]> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }
    return await this.getOrders({ userId: userId });
  }

  private async getOrders(condition: Prisma.OrderWhereInput) {
    try {
      const orders = await this.prisma.order.findMany({
        where: condition,
        select: this.orderSelect,
      });
      return await Promise.all(
        orders.map((order) => this.transformToOrder(order)),
      );
    } catch (error) {
      console.error('Orders could not fetched', error);
      throw new Error('Orders could not fetched');
    }
  }
  async getOrder(orderId: string): Promise<OrderDTO | null> {
    if (!orderId || typeof orderId !== 'string') {
      throw new Error('Invalid order ID');
    }
    const order = await this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: this.orderSelect,
    });
    if (!order) return null;
    return this.transformToOrder(order);
  }

  async updateStatus(orderId: string, status: OrderStatus): Promise<OrderDTO> {
    if (!orderId || typeof orderId !== 'string') {
      throw new Error('Invalid order ID');
    }
    try {
      const order = await this.prisma.order.update({
        where: { id: orderId },
        data: { status },
        select: this.orderSelect,
      });
      return this.transformToOrder(order);
    } catch (error) {
      // console.error(`Order #${orderId} status update failed`, error);
      throw new Error(`Order #${orderId} status could not be updated`);
    }
  }

  async revertOrderStocks(orderId: string) {
    if (!orderId || typeof orderId !== 'string') {
      throw new Error('Invalid order ID');
    }
    try {
      const orderItems = await this.prisma.orderItem.findMany({
        where: { orderId: orderId },
      });

      await this.prisma.$transaction(async (prisma) => {
        await Promise.all(
          orderItems.map((item) =>
            prisma.book.update({
              where: { id: item.bookId },
              data: { stockQuantity: { increment: item.quantity } },
            }),
          ),
        );
      });

      // console.log(`Stock reverted successfully for Order ${orderId}`);
    } catch (error) {
      // console.error('Error while reverting stock counts:', error);
      throw new Error(
        `Stock counts could not be reverted for Order ${orderId}.`,
      );
    }
  }

  private async transformToOrderItem(data: any): Promise<OrderItemDTO> {
    try {
      const item = new BookDTO(
        data.book.id,
        data.book.title,
        data.book.description,
        data.book.isbn,
        { name: data.book.author.name },
        new CategoryDTO(data.book.category.id, data.book.category.name),
        Number(data.book.price.toFixed(2)),
        Number(data.book.rating.toFixed(2)),
        data.book.imageUrl,
      );

      const orderItem = new OrderItemDTO(item, data.quantity);

      const errors = await validate(orderItem);
      if (errors.length > 0) {
        throw new Error('Validation failed.');
      }
      return orderItem;
    } catch (error) {
      console.error('Validation failed. Error:', error);
      throw new Error('Validation failed.');
    }
  }

  private async transformToOrder(order: any): Promise<OrderDTO> {
    try {
      const {
        id,
        user,
        status,
        totalPrice,
        orderItems,
        shippingDetails,
        payment,
        guestName,
        guestEmail,
      } = order;

      const items = await Promise.all(
        orderItems.map((item) => this.transformToOrderItem(item)),
      );

      const orderData = new OrderDTO();
      orderData.id = id;
      orderData.items = items;
      orderData.status = status;
      orderData.price = Number(totalPrice.toFixed(2));
      if (user) {
        orderData.owner = new OrderOwnerDTO(user.id, user.name, user.email);
      } else {
        if (guestEmail?.trim()) {
          orderData.owner = new OrderOwnerDTO(
            null,
            guestName?.trim() || null,
            guestEmail,
          );
        } else {
          orderData.owner = null;
        }
      }

      if (shippingDetails) {
        const shippingData = new ShippingDTO();
        const addressData = new AddressDTO();
        addressData.country = shippingDetails.address.country;
        addressData.state = shippingDetails.address.state;
        addressData.city = shippingDetails.address.city;
        addressData.line1 = shippingDetails.address.line1;
        addressData.line2 = shippingDetails.address.line2;
        addressData.postalCode = shippingDetails.address.postalCode;

        shippingData.email = shippingDetails.email;
        shippingData.phone = shippingDetails.phone || null;
        shippingData.address = addressData;

        orderData.shipping = shippingData;
      }

      if (payment) {
        const paymentData = new PaymentDTO();
        paymentData.id = payment.id;
        paymentData.transactionId = payment.transactionId;
        paymentData.status = payment.status;
        paymentData.method = payment.method;
        paymentData.amount = Number(payment.amount.toFixed(2));

        orderData.payment = paymentData;
      }

      const errors = await validate(orderData);
      if (errors.length > 0) {
        console.error({ errors });
        throw new Error('Validation failed.');
      }
      return orderData;
    } catch (error) {
      console.error('Failed to transform order:', error);
      throw new Error('Order transformation failed.');
    }
  }

  async assignGuestToOrder(orderId: string, email: string, name: string) {
    // trim guestName and guestEmail
    const guestName = name?.trim() || null;
    const guestEmail = email?.trim() || null;

    if (!orderId || !guestEmail) {
      throw new Error(
        'Invalid parameter: orderId and guestEmail are required and cannot be empty',
      );
    }
    try {
      const order = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          guestName,
          guestEmail,
          updatedAt: new Date(),
        },
        select: this.orderSelect,
      });
      return await this.transformToOrder(order);
    } catch (error) {
      console.error(
        `Failed to assign guest to order ${orderId}. Error:`,
        error,
      );
      throw new Error(`Failed to assign guest to order ${orderId}.`);
    }
  }
}
