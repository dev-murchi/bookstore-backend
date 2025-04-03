import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

const mockMailService = {
  sendOrderStatusUpdateMail: jest.fn(),
};
const mockPrismaService = {
  orders: { update: jest.fn() },
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateStatus', () => {
    it('should update order status and send email successfully', async () => {
      const orderId = 1;
      const status = 'shipped';
      const email = 'test@example.com';

      mockPrismaService.orders.update.mockResolvedValue({
        id: orderId,
        shipping_details: { email },
      });

      const result = await service.updateStatus(orderId, status);

      expect(mockPrismaService.orders.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { status },
        select: {
          id: true,
          shipping_details: {
            select: { email: true },
          },
        },
      });
      expect(mockMailService.sendOrderStatusUpdateMail).toHaveBeenCalledWith(
        email,
        orderId,
        status,
      );
      expect(result).toEqual({
        message: `Status is updated and notification mail is sent.`,
      });
    });

    it('should update order status but handle email sending failure', async () => {
      const orderId = 2;
      const status = 'delivered';
      const email = 'test2@example.com';

      mockPrismaService.orders.update.mockResolvedValue({
        id: orderId,
        shipping_details: { email },
      });

      mockMailService.sendOrderStatusUpdateMail.mockRejectedValue(
        new Error('Email send failed'),
      );

      const result = await service.updateStatus(orderId, status);

      expect(mockPrismaService.orders.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { status },
        select: {
          id: true,
          shipping_details: {
            select: { email: true },
          },
        },
      });
      expect(mockMailService.sendOrderStatusUpdateMail).toHaveBeenCalledWith(
        email,
        orderId,
        status,
      );
      expect(result).toEqual({
        message: `Status is updated but notification mail could not sent.`,
      });
    });

    it('should throw an error if order update fails', async () => {
      const orderId = 3;
      const status = 'pending';

      mockPrismaService.orders.update.mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(service.updateStatus(orderId, status)).rejects.toThrow(
        `Status for Order #${orderId} could not updated.`,
      );

      expect(mockMailService.sendOrderStatusUpdateMail).not.toHaveBeenCalled();
    });
  });
});
