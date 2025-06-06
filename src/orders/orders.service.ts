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

@Injectable()
export class OrdersService {
  private readonly bookSelect = {
    id: true,
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

  async getAll(): Promise<OrderDTO[]> {
    return await this.getOrders({});
  }

  async getUserOrders(userId: string): Promise<OrderDTO[]> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid user ID');
    }
    return await this.getOrders({ userid: userId });
  }

  private async getOrders(condition: Prisma.ordersWhereInput) {
    try {
      const orders = await this.prisma.orders.findMany({
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
    const order = await this.prisma.orders.findUnique({
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
      const order = await this.prisma.orders.update({
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
      const orderItems = await this.prisma.order_items.findMany({
        where: { orderid: orderId },
      });

      await this.prisma.$transaction(async (prisma) => {
        await Promise.all(
          orderItems.map((item) =>
            prisma.books.update({
              where: { id: item.bookid },
              data: { stock_quantity: { increment: item.quantity } },
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
        new CategoryDTO(
          data.book.category.id,
          data.book.category.category_name,
        ),
        Number(data.book.price.toFixed(2)),
        Number(data.book.rating.toFixed(2)),
        data.book.image_url,
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
        userid,
        status,
        totalPrice,
        order_items,
        shipping_details,
        payment,
      } = order;

      const items = await Promise.all(
        order_items.map((item) => this.transformToOrderItem(item)),
      );

      const orderData = new OrderDTO();
      orderData.id = id;
      orderData.owner = userid;
      orderData.status = status;
      orderData.items = items;
      orderData.price = Number(totalPrice.toFixed(2));
      if (shipping_details) {
        const shippingData = new ShippingDTO();
        const addressData = new AddressDTO();
        addressData.country = shipping_details.address.country;
        addressData.state = shipping_details.address.state;
        addressData.city = shipping_details.address.city;
        addressData.line1 = shipping_details.address.line1;
        addressData.line2 = shipping_details.address.line2;
        addressData.postalCode = shipping_details.address.postalCode;

        shippingData.email = shipping_details.email;
        shippingData.phone = shipping_details.phone;
        shippingData.address = addressData;

        orderData.shipping = shippingData;
      }

      if (payment) {
        const paymentData = new PaymentDTO();
        paymentData.transactionId = payment.transaction_id;
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
}
