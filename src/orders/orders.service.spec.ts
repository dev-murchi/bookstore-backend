import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

const mockOrder = {
  id: 1,
  userid: 101,
  totalPrice: 42.5,
  status: 'pending',
  shipping_details: { email: 'user@example.com' },
  order_items: [
    {
      id: 1,
      quantity: 2,
      book: {
        id: 10,
        title: 'Book Title',
        author: { name: 'Author Name' },
      },
    },
  ],
};

const mockPrismaService = {
  orders: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);

    // Clear all mock history before each test
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('returns all orders when no userId is provided', async () => {
      mockPrismaService.orders.findMany.mockResolvedValueOnce([mockOrder]);

      const result = await service.getAll();

      expect(mockPrismaService.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result).toEqual([mockOrder]);
    });

    it('returns orders filtered by userId', async () => {
      mockPrismaService.orders.findMany.mockResolvedValueOnce([mockOrder]);

      const result = await service.getAll(101);

      expect(mockPrismaService.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user: { id: 101 } } }),
      );
      expect(result).toEqual([mockOrder]);
    });

    it('throws an error if findMany fails', async () => {
      mockPrismaService.orders.findMany.mockRejectedValueOnce(
        new Error('DB failure'),
      );

      await expect(service.getAll()).rejects.toThrow(
        'Orders could not fetched',
      );
    });
  });

  describe('getOrder', () => {
    it('returns the order if found', async () => {
      mockPrismaService.orders.findUnique.mockResolvedValueOnce(mockOrder);

      const result = await service.getOrder(1);

      expect(mockPrismaService.orders.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: expect.anything(),
      });
      expect(result).toEqual(mockOrder);
    });

    it('returns null if no order found', async () => {
      mockPrismaService.orders.findUnique.mockResolvedValueOnce(null);

      const result = await service.getOrder(999);

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('successfully updates order status', async () => {
      const updatedOrder = { ...mockOrder, status: 'shipped' };
      mockPrismaService.orders.update.mockResolvedValueOnce(updatedOrder);

      const result = await service.updateStatus(1, 'shipped');

      expect(mockPrismaService.orders.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'shipped' },
        select: expect.anything(),
      });
      expect(result).toEqual(updatedOrder);
    });

    it('throws error if update fails', async () => {
      mockPrismaService.orders.update.mockRejectedValueOnce(
        new Error('Update failed'),
      );

      await expect(service.updateStatus(1, 'shipped')).rejects.toThrow(
        'Order #1 status could not be updated',
      );
    });
  });
});
