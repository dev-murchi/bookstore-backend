import { Injectable } from '@nestjs/common';
import {
  RefundData,
  CreateRefundData,
  UpdateRefundData,
} from '../common/types/refund-data.types';
import { PrismaService } from '../prisma/prisma.service';
import { RefundStatus } from '../common/enum/refund-status.enum';

@Injectable()
export class RefundService {
  readonly refundSelect = {
    refundId: true,
    amount: true,
    status: true,
    failureReason: true,
    createdAt: true,
    updatedAt: true,
    orderId: true,
  };

  constructor(private readonly prisma: PrismaService) {}

  async find(refundId: string): Promise<RefundData | null> {
    try {
      const refund = await this.prisma.refund.findUnique({
        where: { refundId },
        select: this.refundSelect,
      });

      if (!refund) return null;

      return { ...refund, amount: Number(refund.amount) };
    } catch (error) {
      console.error(
        `Failed to retrieve the Refund: ${refundId}. Error:`,
        error,
      );
      throw new Error(`Failed to retrieve the Refund: ${refundId}.`);
    }
  }

  async create(data: CreateRefundData): Promise<RefundData> {
    try {
      const refund = await this.prisma.refund.create({
        data: {
          refundId: data.refundId,
          order: { connect: { id: data.orderId } },
          amount: data.amount,
          status: RefundStatus.RefundCreated,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        select: this.refundSelect,
      });

      return { ...refund, amount: Number(refund.amount) };
    } catch (error) {
      console.error(
        `Failed to create a refund for the Order: ${data.orderId}. Error:`,
        error,
      );
      throw new Error(
        `Failed to create a refund for the Order: ${data.orderId}`,
      );
    }
  }

  async update(data: UpdateRefundData): Promise<RefundData> {
    try {
      const refund = await this.prisma.refund.update({
        where: { refundId: data.refundId },
        data: {
          status: data.status,
          failureReason: data?.failureReason || null,
          updatedAt: new Date(),
        },
        select: this.refundSelect,
      });

      return { ...refund, amount: Number(refund.amount) };
    } catch (error) {
      console.error(
        `Failed to update the Refund: ${data.refundId}. Error:`,
        error,
      );
      throw new Error(`Failed to update the Refund: ${data.refundId}`);
    }
  }

  async delete(refundId: string): Promise<{ message: string }> {
    try {
      await this.prisma.refund.delete({
        where: { refundId },
      });

      return { message: `Refund: ${refundId} is deleted.` };
    } catch (error) {
      console.error(`Failed to delete the Refund: ${refundId}. Error:`, error);
      throw new Error(`Failed to delete the Refund: ${refundId}.`);
    }
  }
}
