import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from './enum/order-status.enum';

const mockOrder = {
  orderid: 'order-uuid-1',
  userid: 'user-uuid-101',
  totalPrice: 42.5,
  status: 'pending',
  order_items: [
    {
      quantity: 2,
      book: {
        bookid: 'book-uuid-1',
        title: 'Test Book',
        description: 'test book',
        isbn: 'test-isbn',
        price: 21.25,
        rating: 4.0,
        image_url: 'book-image-url',
        author: { name: 'test author' },
        category: { id: 1, category_name: 'test category' },
      },
    },
  ],
  shipping_details: null,
  payment: null,
};

const mockPrismaService = {
  orders: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  order_items: {
    findMany: jest.fn(),
  },
  books: {
    update: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn()),
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
      expect(result).toEqual([
        {
          id: 'order-uuid-1',
          owner: 'user-uuid-101',
          status: 'pending',
          price: 42.5,
          items: [
            {
              quantity: 2,
              item: {
                id: 'book-uuid-1',
                title: 'Test Book',
                description: 'test book',
                isbn: 'test-isbn',
                price: 21.25,
                rating: 4.0,
                imageUrl: 'book-image-url',
                author: { name: 'test author' },
                category: { id: 1, value: 'test category' },
              },
            },
          ],
          shipping: null,
          payment: null,
        },
      ]);
    });

    it('returns orders filtered by userId', async () => {
      mockPrismaService.orders.findMany.mockResolvedValueOnce([mockOrder]);

      const result = await service.getUserOrders('user-uuid-101');

      expect(mockPrismaService.orders.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userid: 'user-uuid-101' },
        }),
      );
      expect(result).toEqual([
        {
          id: 'order-uuid-1',
          owner: 'user-uuid-101',
          status: 'pending',
          price: 42.5,
          items: [
            {
              quantity: 2,
              item: {
                id: 'book-uuid-1',
                title: 'Test Book',
                description: 'test book',
                isbn: 'test-isbn',
                price: 21.25,
                rating: 4.0,
                imageUrl: 'book-image-url',
                author: { name: 'test author' },
                category: { id: 1, value: 'test category' },
              },
            },
          ],
          shipping: null,
          payment: null,
        },
      ]);
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

      const result = await service.getOrder('order-uuid-1');

      expect(mockPrismaService.orders.findUnique).toHaveBeenCalledWith({
        where: { orderid: 'order-uuid-1' },
        select: expect.anything(),
      });
      expect(result).toEqual({
        id: 'order-uuid-1',
        owner: 'user-uuid-101',
        status: 'pending',
        price: 42.5,
        items: [
          {
            quantity: 2,
            item: {
              id: 'book-uuid-1',
              title: 'Test Book',
              description: 'test book',
              isbn: 'test-isbn',
              price: 21.25,
              rating: 4.0,
              imageUrl: 'book-image-url',
              author: { name: 'test author' },
              category: { id: 1, value: 'test category' },
            },
          },
        ],
        shipping: null,
        payment: null,
      });
    });

    it('throws an error if no order found', async () => {
      mockPrismaService.orders.findUnique.mockResolvedValueOnce(null);

      const result = await service.getOrder('order-uuid-999');
      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('successfully updates order status', async () => {
      const updatedOrder = { ...mockOrder, status: 'canceled' };
      mockPrismaService.orders.update.mockResolvedValueOnce(updatedOrder);

      const result = await service.updateStatus(
        'order-uuid-1',
        OrderStatus.Canceled,
      );

      expect(mockPrismaService.orders.update).toHaveBeenCalledWith({
        where: { orderid: 'order-uuid-1' },
        data: { status: 'canceled' },
        select: expect.anything(),
      });
      expect(result).toEqual({
        id: 'order-uuid-1',
        owner: 'user-uuid-101',
        status: 'canceled',
        price: 42.5,
        items: [
          {
            quantity: 2,
            item: {
              id: 'book-uuid-1',
              title: 'Test Book',
              description: 'test book',
              isbn: 'test-isbn',
              price: 21.25,
              rating: 4.0,
              imageUrl: 'book-image-url',
              author: { name: 'test author' },
              category: { id: 1, value: 'test category' },
            },
          },
        ],
        shipping: null,
        payment: null,
      });
    });

    it('throws error if update fails', async () => {
      mockPrismaService.orders.update.mockRejectedValueOnce(
        new Error('Update failed'),
      );

      await expect(
        service.updateStatus('order-uuid-1', OrderStatus.Shipped),
      ).rejects.toThrow('Order #order-uuid-1 status could not be updated');
    });
  });

  describe('revertOrderStocks', () => {
    it('should revert stocks successfully for valid order items', async () => {
      mockPrismaService.order_items.findMany.mockResolvedValueOnce([
        {
          bookid: 'booki-uuid-10',
          quantity: 2,
        },
      ]);
      mockPrismaService.books.update.mockResolvedValueOnce({});

      await service.revertOrderStocks('order-uuid-1');

      expect(mockPrismaService.order_items.findMany).toHaveBeenCalledWith({
        where: { orderid: 'order-uuid-1' },
      });

      expect(mockPrismaService.books.update).toHaveBeenCalledWith({
        where: { bookid: 'booki-uuid-10' },
        data: { stock_quantity: { increment: 2 } },
      });
    });

    it('should throw an error if updating the stock fails', async () => {
      mockPrismaService.order_items.findMany.mockResolvedValueOnce([
        {
          bookid: 'booki-uuid-10',
          quantity: 2,
        },
      ]);
      mockPrismaService.books.update.mockRejectedValue(new Error('DB error'));

      await expect(service.revertOrderStocks('order-uuid-1')).rejects.toThrow(
        'Stock counts could not be reverted for Order order-uuid-1.',
      );

      expect(mockPrismaService.order_items.findMany).toHaveBeenCalledWith({
        where: { orderid: 'order-uuid-1' },
      });

      expect(mockPrismaService.books.update).toHaveBeenCalledWith({
        where: { bookid: 'booki-uuid-10' },
        data: { stock_quantity: { increment: 2 } },
      });
    });
  });
});
