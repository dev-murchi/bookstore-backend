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

  async getAll(): Promise<OrderDTO[]> {
    return await this.getOrders({});
  }

  async getUserOrders(userId: string): Promise<OrderDTO[]> {
    return await this.getOrders({ userid: userId });
  }

  private async getOrders(coondition: Prisma.ordersWhereInput) {
    try {
      const orders = await this.prisma.orders.findMany({
        where: coondition,
        select: this.orderSelect,
      });
      return orders.map((order) => this.transformToOrder(order));
    } catch (error) {
      console.error('Orders could not fetched', error);
      throw new Error('Orders could not fetched');
    }
  }
  async getOrder(orderId: string): Promise<OrderDTO | null> {
    const order = await this.prisma.orders.findUnique({
      where: {
        orderid: orderId,
      },
      select: this.orderSelect,
    });
    if (!order) return null;
    return this.transformToOrder(order);
  }

  async updateStatus(orderId: string, status: OrderStatus): Promise<OrderDTO> {
    try {
      const order = await this.prisma.orders.update({
        where: { orderid: orderId },
        data: { status },
        select: this.orderSelect,
      });
      return this.transformToOrder(order);
    } catch (error) {
      console.error(`Order #${orderId} status update failed`, error);
      throw new Error(`Order #${orderId} status could not be updated`);
    }
  }

  async revertOrderStocks(orderId: string) {
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

  private transformToOrderItem(data: any): OrderItemDTO {
    const orderItem = new OrderItemDTO();
    orderItem.quantity = data.quantity;
    orderItem.item = new BookDTO(
      data.book.bookid,
      data.book.title,
      data.book.description,
      data.book.isbn,
      { name: data.book.author.name },
      new CategoryDTO(data.book.category.id, data.book.category.category_name),
      Number(data.book.price.toFixed(2)),
      Number(data.book.rating.toFixed(2)),
      data.book.image_url,
    );

    return orderItem;
  }

  private transformToOrder(order: any): OrderDTO {
    const {
      orderid,
      userid,
      status,
      totalPrice,
      order_items,
      shipping_details,
      payment,
    } = order;

    const items = order_items.map((item) => this.transformToOrderItem(item));

    const shippingData = new ShippingDTO();

    if (shipping_details) {
      const addressData = new AddressDTO();
      addressData.country = shipping_details.country;
      addressData.state = shipping_details.state;
      addressData.city = shipping_details.city;
      addressData.line1 = shipping_details.line1;
      addressData.line2 = shipping_details.line2;
      addressData.postalCode = shipping_details.postalCode;

      shippingData.email = shipping_details.email;
      shippingData.phone = shipping_details.phone;
      shippingData.address = addressData;
    }

    const paymentData = new PaymentDTO();
    if (payment) {
      paymentData.transactionId = payment.transaction_id;
      paymentData.status = payment.status;
      paymentData.method = payment.method;
      paymentData.amount = Number(payment.amount.toFixed(2));
    }

    const orderData = new OrderDTO();
    orderData.id = orderid;
    orderData.owner = userid;
    orderData.status = status;
    orderData.items = items;
    orderData.price = Number(totalPrice.toFixed(2));
    orderData.shipping = shippingData;
    orderData.payment = paymentData;

    return orderData;
  }
}
