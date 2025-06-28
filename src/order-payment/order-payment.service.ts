import { Injectable } from '@nestjs/common';
import { PaymentData } from '../common/types/payment-data.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrderPaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: PaymentData) {
    try {
      return await this.prisma.orderPayment.create({
        data: {
          transactionId: data.transactionId,
          amount: data.amount,
          order: { connect: { id: data.orderId } },
          status: data.status,
          method: 'card',
        },
      });
    } catch (error) {
      console.error(
        `Failed to create an order payment for the Order ${data.orderId}. Error:`,
        error,
      );
      throw new Error(
        `Failed to create an order payment for the Order ${data.orderId}`,
      );
    }
  }

  async find(orderId: string) {
    try {
      const payment = await this.prisma.orderPayment.findUnique({
        where: { orderId },
      });
      if (!payment) return null;
      return payment;
    } catch (error) {
      console.error(
        `Failed to retrieve the payment for the Order ${orderId}. Error:`,
        error,
      );
      throw new Error(
        `Failed to retrieve the payment for the Order ${orderId}`,
      );
    }
  }

  async findAll() {
    try {
      const payments = await this.prisma.orderPayment.findMany();
      return payments;
    } catch (error) {
      console.error('Failed to retrieve the order payments. Error:', error);
      throw new Error('Failed to retrieve the order payments');
    }
  }

  async update(data: PaymentData) {
    try {
      const payment = await this.prisma.orderPayment.update({
        where: {
          orderId: data.orderId,
        },
        data: {
          transactionId: data.transactionId,
          amount: data.amount,
          status: data.status,
          method: 'card',
          updatedAt: new Date(),
        },
      });
      return payment;
    } catch (error) {
      console.error(
        `Failed to update order payment details for the Order ${data.orderId}. Error:`,
        error,
      );
      throw new Error(
        `Failed to update order payment details for the Order ${data.orderId}`,
      );
    }
  }

  async delete(orderId: string) {
    try {
      await this.prisma.orderPayment.delete({ where: { orderId } });
    } catch (error) {
      console.error(
        `Failed to delete order payment for the Order ${orderId}. Error:`,
        error,
      );
      throw new Error(
        `Failed to delete order payment for the Order ${orderId}`,
      );
    }
  }
}
