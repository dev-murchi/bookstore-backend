import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

export const orderShipped = {
  subject: 'Your Books are on Their Way! Order #123456',
  greeting: 'Hi John Doe',
  body: [
    "Great news! We're happy to let you know that your order #123456, placed on October 1, 2023, has shipped!",
    "Your books are now making their journey to you, and we're excited for you to receive them.",
    'You can expect them to arrive within the estimated delivery window.',
    "We'll send you another email with tracking information as soon as it's available, so you can follow your order's progress.",
    'Thanks again for choosing [Your Online Bookstore Name]. We hope you enjoy your new reads!',
  ],
  signOff: 'Warmly,',
  signature: 'The Team at [Your Online Bookstore Name]',
};
export const orderDelivered = {
  subject: 'Your Book Order #123456 Has Arrived!',
  greeting: 'Dear John Doe',
  body: [
    "We're pleased to confirm that your order #123456, placed on October 1, 2023, has been delivered.",
    "We hope you're enjoying your new books!",
    "If you have any questions or require further assistance, please don't hesitate to contact us.",
    'Thank you for choosing [Your Online Bookstore Name]. We appreciate your support.',
  ],
  signOff: 'Warmly',
  signature: 'The Team at [Your Online Bookstore Name]',
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}
  async updateStatus(orderId: number, status: string) {
    try {
      // update order status
      const order = await this.prisma.orders.update({
        where: { id: orderId },
        data: { status },
        select: {
          id: true,
          shipping_details: {
            select: { email: true },
          },
        },
      });

      // send status update mail to the client
      try {
        await this.mailService.sendOrderStatusUpdateMail(
          order.shipping_details.email,
          orderId,
          status,
        );
      } catch (error) {
        console.warn(error);
        return {
          message: `Status is updated but notification mail could not sent.`,
        };
      }

      return {
        message: `Status is updated and notification mail is sent.`,
      };
    } catch (error) {
      throw new Error(`Status for Order #${orderId} could not updated.`);
    }
  }
}
