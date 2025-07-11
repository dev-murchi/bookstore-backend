import { Test, TestingModule } from '@nestjs/testing';
import { OrderPaymentService } from './order-payment.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { PaymentData } from 'src/common/types/payment-data.interface';
import { PaymentStatus } from 'src/common/enum/payment-status.enum';

const mockPrismaService = {
  orderPayment: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockPaymentData: PaymentData = {
  orderId: 'order-uuid-1',
  transactionId: 'pi-transaction-id',
  amount: 100,
  status: PaymentStatus.Failed,
};

describe('OrderPaymentService', () => {
  let service: OrderPaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderPaymentService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OrderPaymentService>(OrderPaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw error when database error occurs', async () => {
      mockPrismaService.orderPayment.create.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(service.create(mockPaymentData)).rejects.toThrow(
        `Failed to create an order payment for the Order ${mockPaymentData.orderId}`,
      );
    });

    it('should create the order payment', async () => {
      const mockPrismaData = {
        id: 1,
        transactionId: mockPaymentData.transactionId,
        status: mockPaymentData.status,
        method: 'card',
        amount: mockPaymentData.amount,
        orderId: mockPaymentData.orderId,
      };
      mockPrismaService.orderPayment.create.mockReturnValueOnce(mockPrismaData);

      const result = await service.create(mockPaymentData);
      expect(result).toEqual(mockPrismaData);
    });
  });
  describe('find', () => {
    it('should throw error when database error occurs', async () => {
      mockPrismaService.orderPayment.findUnique.mockRejectedValueOnce(
        new Error('DB Error'),
      );
      await expect(service.find(mockPaymentData.orderId)).rejects.toThrow(
        `Failed to retrieve the payment for the Order ${mockPaymentData.orderId}`,
      );
    });

    it('should find the order payment', async () => {
      const mockPrismaData = {
        id: 1,
        transactionId: mockPaymentData.transactionId,
        status: mockPaymentData.status,
        method: 'card',
        amount: mockPaymentData.amount,
        orderId: mockPaymentData.orderId,
      };

      mockPrismaService.orderPayment.findUnique
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockPrismaData);

      const resultForNonexistentPayment = await service.find(
        mockPaymentData.orderId,
      );
      expect(resultForNonexistentPayment).toBeNull();

      const resultForExistingPayment = await service.find(
        mockPaymentData.orderId,
      );
      expect(resultForExistingPayment).toEqual(mockPrismaData);
    });
  });

  describe('findAll', () => {
    it('should throw error when database error occurs', async () => {
      mockPrismaService.orderPayment.findMany.mockRejectedValueOnce(
        new Error('DB Error'),
      );
      await expect(service.findAll()).rejects.toThrow(
        'Failed to retrieve the order payments',
      );
    });

    it('should findAll the order payment', async () => {
      const mockPrismaData = {
        id: 1,
        transactionId: mockPaymentData.transactionId,
        status: mockPaymentData.status,
        method: 'card',
        amount: mockPaymentData.amount,
        orderId: mockPaymentData.orderId,
      };

      mockPrismaService.orderPayment.findMany
        .mockReturnValueOnce([])
        .mockReturnValueOnce([mockPrismaData]);

      const resultWithEmptyPayment = await service.findAll();
      expect(resultWithEmptyPayment).toEqual([]);

      const resultWithPayments = await service.findAll();
      expect(resultWithPayments).toEqual([mockPrismaData]);
    });
  });
  describe('update', () => {
    it('should throw error when database error occurs', async () => {
      mockPrismaService.orderPayment.update.mockRejectedValueOnce(
        new Error('DB Error'),
      );
      await expect(
        service.update({ ...mockPaymentData, status: PaymentStatus.Paid }),
      ).rejects.toThrow(
        `Failed to update order payment details for the Order ${mockPaymentData.orderId}`,
      );
    });

    it('should update the order payment', async () => {
      const mockPrismaData = {
        id: 1,
        transactionId: mockPaymentData.transactionId,
        status: PaymentStatus.Paid,
        method: 'card',
        amount: mockPaymentData.amount,
        orderId: mockPaymentData.orderId,
      };
      mockPrismaService.orderPayment.update.mockReturnValueOnce(mockPrismaData);

      const result = await service.update({
        ...mockPaymentData,
        status: PaymentStatus.Paid,
      });
      expect(result).toEqual(mockPrismaData);
      expect(mockPrismaService.orderPayment.update).toHaveBeenCalledWith({
        where: {
          orderId: mockPaymentData.orderId,
        },
        data: {
          transactionId: mockPaymentData.transactionId,
          amount: mockPaymentData.amount,
          status: PaymentStatus.Paid,
          method: 'card',
          updatedAt: expect.any(Date),
        },
      });
    });
  });

  describe('delete', () => {
    it('should throw error when database error occurs', async () => {
      mockPrismaService.orderPayment.delete.mockRejectedValueOnce(
        new Error('DB Error'),
      );
      await expect(service.delete(mockPaymentData.orderId)).rejects.toThrow(
        `Failed to delete order payment for the Order ${mockPaymentData.orderId}`,
      );
    });

    it('should delete the order payment', async () => {
      mockPrismaService.orderPayment.delete.mockReturnValueOnce({});
      await expect(
        service.delete(mockPaymentData.orderId),
      ).resolves.toBeUndefined();
    });
  });
});
