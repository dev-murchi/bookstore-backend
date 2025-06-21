import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface ShippingCustomerDetails {
  email: string;
  name: string;
  address: ShippingAddress;
}

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}
  async createShipping(orderId: string, data: ShippingCustomerDetails) {
    try {
      const shipping = await this.prisma.shipping.create({
        data: {
          email: data.email,
          name: data.name,
          order: { connect: { id: orderId } },
          address: {
            create: {
              country: data.address.country,
              state: data.address.state,
              city: data.address.city,
              line1: data.address.line1,
              line2: data.address.line2,
              postalCode: data.address.postalCode,
            },
          },
        },
      });

      return shipping;
    } catch (error) {
      console.error(
        `Shipping details could not be created for Order ${orderId}`,
        error,
      );
      throw new Error(
        `Shipping details could not be created for Order ${orderId}`,
      );
    }
  }

  async findByOrder(orderId: string) {
    try {
      const shipping = await this.prisma.shipping.findUnique({
        where: { orderId },
        select: {
          id: true,
          orderId: true,
          address: true,
          name: true,
          email: true,
        },
      });
      if (!shipping) return null;
      return shipping;
    } catch (error) {
      throw new Error(`Failed to find a shipping for the order ${orderId}`);
    }
  }
}
