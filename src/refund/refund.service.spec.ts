import { Test, TestingModule } from '@nestjs/testing';
import { RefundService } from './refund.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RefundStatus } from 'src/common/enum/refund-status.enum';

const mockPrismaService = {
  refund: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};
const prismaSelectQuery = {
  refundId: true,
  amount: true,
  status: true,
  failureReason: true,
  createdAt: true,
  updatedAt: true,
  orderId: true,
};
describe('RefundService', () => {
  let service: RefundService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RefundService>(RefundService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('find', () => {
    it('should throw error', async () => {
      mockPrismaService.refund.findUnique.mockRejectedValueOnce(
        new Error('DB Error'),
      );
      const refundId = 'refund-id-1';
      await expect(service.find(refundId)).rejects.toThrow(
        `Failed to retrieve the Refund: ${refundId}.`,
      );
    });
    it('should find the refund', async () => {
      const refundId1 = 'refund-id-1';
      const refundId2 = 'refund-id-1';
      const refund = {
        refundId: refundId2,
        amount: 100,
        status: RefundStatus.RefundComplete,
        failureReason: null,
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago
        updatedAt: new Date(),
        orderId: 'order-uuid-1',
      };

      mockPrismaService.refund.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(refund);

      const refund1 = await service.find(refundId1);
      const refund2 = await service.find(refundId2);

      expect(refund1).toBeNull();
      expect(refund2).toEqual(refund);
    });
  });
  describe('create', () => {
    it('should throw error', async () => {
      mockPrismaService.refund.create.mockRejectedValueOnce(
        new Error('DB Error'),
      );
      const refundId = 'refund-id-1';
      const data = {
        refundId,
        orderId: 'order-uuid-1',
        amount: 100,
      };
      await expect(service.create(data)).rejects.toThrow(
        `Failed to create a refund for the Order: ${data.orderId}`,
      );
    });
    it('should create the refund', async () => {
      const refundId = 'refund-id-1';
      const data = {
        refundId,
        orderId: 'order-uuid-1',
        amount: 100,
      };

      const createdRefund = {
        refundId,
        amount: 100,
        status: RefundStatus.RefundComplete,
        failureReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        orderId: data.orderId,
      };
      mockPrismaService.refund.create.mockResolvedValueOnce(createdRefund);

      const result = await service.create(data);
      expect(result).toEqual(createdRefund);
      expect(mockPrismaService.refund.create).toHaveBeenCalledWith({
        data: {
          refundId: data.refundId,
          order: { connect: { id: data.orderId } },
          amount: data.amount,
          status: RefundStatus.RefundCreated,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
        select: prismaSelectQuery,
      });
    });
  });
  describe('update', () => {
    it('should throw error', async () => {
      mockPrismaService.refund.update.mockRejectedValueOnce(
        new Error('DB Error'),
      );
      const refundId = 'refund-id-1';
      const data = { refundId, status: RefundStatus.RefundComplete };
      await expect(service.update(data)).rejects.toThrow(
        `Failed to update the Refund: ${data.refundId}`,
      );
    });
    it('should update the refund', async () => {
      const refundId = 'refund-id-1';
      const data = { refundId, status: RefundStatus.RefundComplete };
      const updatedRefund = {
        refundId,
        amount: 100,
        status: RefundStatus.RefundComplete,
        failureReason: null,
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago
        updatedAt: new Date(),
        orderId: 'order-uuid-1',
      };
      mockPrismaService.refund.update.mockResolvedValueOnce(updatedRefund);

      const result = await service.update(data);
      expect(result).toEqual(updatedRefund);
      expect(mockPrismaService.refund.update).toHaveBeenCalledWith({
        where: { refundId: data.refundId },
        data: {
          status: data.status,
          failureReason: null,
          updatedAt: expect.any(Date),
        },
        select: prismaSelectQuery,
      });
    });
  });
  describe('delete', () => {
    it('should throw error', async () => {
      mockPrismaService.refund.delete.mockRejectedValueOnce(
        new Error('DB Error'),
      );
      const refundId = 'refund-id-1';
      await expect(service.delete(refundId)).rejects.toThrow(
        `Failed to delete the Refund: ${refundId}.`,
      );
    });
    it('should delete the refund', async () => {
      mockPrismaService.refund.delete.mockResolvedValueOnce({});
      const refundId = 'refund-id-1';
      const result = await service.delete(refundId);
      expect(result).toEqual({ message: `Refund: ${refundId} is deleted.` });
    });
  });
});
