import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../common/enum/order-status.enum';
import { OrderItemDTO } from '../common/dto/order-item.dto';
import { BookDTO } from '../common/dto/book.dto';
import { CategoryDTO } from '../common/dto/category.dto';
import * as classValidator from 'class-validator';
import { AddressDTO } from '../common/dto/address.dto';
import { ShippingDTO } from '../common/dto/shipping.dto';
import { PaymentDTO } from '../common/dto/payment.dto';

const orderId1 = '461802bb-8792-42f6-b4b3-a620f91cedb6'; // just example
const orderId2 = '58fcf574-f144-4c3e-8eb1-72efe85541db'; // just example
const orderIdNotFound = '2588f1af-b483-4c4d-ab2c-e5b3efd8c155'; // just example
const userId = '5610eb78-6602-4408-88f6-c2889cd136b7'; // just example
const bookId = 'ba22e8c2-8d5f-4ae2-835d-12f488667aed'; // just example
const mockPaymentId = 'abcdef01-2345-6789-abcd-ef0123456789'; // just example

const mockPrismaOrder1 = {
  id: orderId1,
  user: { id: userId, name: 'user name', email: 'user@email.com' },
  totalPrice: 21.25,
  status: 'pending',
  orderItems: [
    {
      quantity: 1,
      book: {
        id: bookId,
        title: 'Test Book',
        description: 'test book description',
        isbn: 'book-isbn',
        price: 21.25,
        rating: 4.0,
        imageUrl: 'book-image-url',
        author: { name: 'Traveller Hobbit' },
        category: { id: 1, name: 'test category' },
      },
    },
  ],
  shippingDetails: null,
  payment: null,
};

const mockPrismaOrder2 = {
  id: orderId2,
  user: { id: userId, name: 'user name', email: 'user@email.com' },
  totalPrice: 42.5,
  status: 'complete',
  orderItems: [
    {
      quantity: 2,
      book: {
        id: bookId,
        title: 'Test Book',
        description: 'test book description',
        isbn: 'book-isbn',
        price: 21.25,
        rating: 4.0,
        imageUrl: 'book-image-url',
        author: { name: 'Traveller Hobbit' },
        category: { id: 1, name: 'test category' },
      },
    },
  ],
  shippingDetails: {
    email: 'aragorn@gondor.com',
    phone: '+44 1234 567890',
    address: {
      country: 'Middle-earth',
      state: 'Gondor',
      city: 'Minas Tirith',
      line1: '1 White Tower',
      line2: 'Room 101',
      postalCode: 'MT-001',
    },
  },
  payment: {
    id: mockPaymentId,
    transactionId: 'lotr_txn_00112233',
    status: 'completed',
    method: 'ring_coin',
    amount: 42.5,
  },
};

const mockPrismaService = {
  order: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  orderItem: {
    findMany: jest.fn(),
  },
  book: {
    update: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrismaService)),
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
    it('should retrieve all orders', async () => {
      mockPrismaService.order.findMany.mockResolvedValueOnce([
        mockPrismaOrder1,
        mockPrismaOrder2,
      ]);

      const expectedAddress = new AddressDTO();
      expectedAddress.country = 'Middle-earth';
      expectedAddress.state = 'Gondor';
      expectedAddress.city = 'Minas Tirith';
      expectedAddress.line1 = '1 White Tower';
      expectedAddress.line2 = 'Room 101';
      expectedAddress.postalCode = 'MT-001';

      const expectedShipping = new ShippingDTO();
      expectedShipping.address = expectedAddress;
      expectedShipping.email = 'aragorn@gondor.com';
      expectedShipping.phone = '+44 1234 567890';

      const expectedPayment = new PaymentDTO();
      expectedPayment.id = mockPaymentId;
      expectedPayment.transactionId = 'lotr_txn_00112233';
      expectedPayment.status = 'completed';
      expectedPayment.method = 'ring_coin';
      expectedPayment.amount = 42.5;

      const result = await service.getAll();

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(result).toEqual([
        {
          id: orderId1,
          owner: userId,
          status: 'pending',
          price: 21.25,
          items: [
            new OrderItemDTO(
              new BookDTO(
                bookId,
                'Test Book',
                'test book description',
                'book-isbn',
                { name: 'Traveller Hobbit' },
                new CategoryDTO(1, 'test category'),
                21.25,
                4.0,
                'book-image-url',
              ),
              1,
            ),
          ],
        },
        {
          id: orderId2,
          owner: userId,
          status: 'complete',
          price: 42.5,
          items: [
            new OrderItemDTO(
              new BookDTO(
                bookId,
                'Test Book',
                'test book description',
                'book-isbn',
                { name: 'Traveller Hobbit' },
                new CategoryDTO(1, 'test category'),
                21.25,
                4.0,
                'book-image-url',
              ),
              2,
            ),
          ],
          shipping: expectedShipping,
          payment: expectedPayment,
        },
      ]);
    });

    it('should return [] when no orders found', async () => {
      mockPrismaService.order.findMany.mockResolvedValueOnce([]);
      const result = await service.getAll();
      expect(result).toEqual([]);
    });

    it('should throw an error if findMany fails', async () => {
      mockPrismaService.order.findMany.mockRejectedValueOnce(
        new Error('DB failure'),
      );

      await expect(service.getAll()).rejects.toThrow(
        'Orders could not fetched',
      );
    });
  });

  describe('getUserOrders', () => {
    it('should get orders for a user', async () => {
      mockPrismaService.order.findMany.mockResolvedValueOnce([
        mockPrismaOrder1,
      ]);
      const result = await service.getUserOrders(userId);
      expect(result).toHaveLength(1);
    });

    it('should throw if userId is invalid', async () => {
      await expect(service.getUserOrders(null as any)).rejects.toThrow(
        'Invalid user ID',
      );
    });
  });

  describe('getOrder', () => {
    it('should get an order by ID', async () => {
      mockPrismaService.order.findUnique.mockResolvedValueOnce(
        mockPrismaOrder1,
      );

      const result = await service.getOrder(orderId1);

      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: orderId1 },
        select: expect.anything(),
      });
      expect(result).toEqual({
        id: orderId1,
        owner: userId,
        status: 'pending',
        price: 21.25,
        items: [
          new OrderItemDTO(
            new BookDTO(
              bookId,
              'Test Book',
              'test book description',
              'book-isbn',
              { name: 'Traveller Hobbit' },
              new CategoryDTO(1, 'test category'),
              21.25,
              4.0,
              'book-image-url',
            ),
            1,
          ),
        ],
      });
    });

    it('should return null if not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValueOnce(null);

      const result = await service.getOrder(orderIdNotFound);
      expect(result).toBeNull();
    });

    it('should throw for invalid order ID', async () => {
      await expect(service.getOrder(null as any)).rejects.toThrow(
        'Invalid order ID',
      );
    });
  });

  describe('updateStatus', () => {
    it('should update the status', async () => {
      const updatedOrder = { ...mockPrismaOrder1, status: 'canceled' };
      mockPrismaService.order.update.mockResolvedValueOnce(updatedOrder);

      const result = await service.updateStatus(orderId1, OrderStatus.Canceled);

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: orderId1 },
        data: { status: 'canceled' },
        select: expect.anything(),
      });
      expect(result).toEqual({
        id: orderId1,
        owner: userId,
        status: 'canceled',
        price: 21.25,
        items: [
          new OrderItemDTO(
            new BookDTO(
              bookId,
              'Test Book',
              'test book description',
              'book-isbn',
              { name: 'Traveller Hobbit' },
              new CategoryDTO(1, 'test category'),
              21.25,
              4.0,
              'book-image-url',
            ),
            1,
          ),
        ],
      });
    });

    it('should throw an error if update fails', async () => {
      mockPrismaService.order.update.mockRejectedValueOnce(
        new Error('Update failed'),
      );

      await expect(
        service.updateStatus(orderId1, OrderStatus.Shipped),
      ).rejects.toThrow(`Order #${orderId1} status could not be updated`);
    });

    it('should throws an error if the ID is invalid', async () => {
      await expect(
        service.updateStatus('', OrderStatus.Shipped),
      ).rejects.toThrow('Invalid order ID');
    });
  });

  describe('revertOrderStocks', () => {
    it('should revert stocks correctly', async () => {
      mockPrismaService.orderItem.findMany.mockResolvedValueOnce([
        {
          bookId: 'booki-uuid-10',
          quantity: 2,
        },
      ]);
      mockPrismaService.book.update.mockResolvedValueOnce({});

      await expect(service.revertOrderStocks(orderId1)).resolves.not.toThrow();

      expect(mockPrismaService.orderItem.findMany).toHaveBeenCalledWith({
        where: { orderId: orderId1 },
      });

      expect(mockPrismaService.book.update).toHaveBeenCalledWith({
        where: { id: 'booki-uuid-10' },
        data: { stockQuantity: { increment: 2 } },
      });
    });

    it('should throw an error if the order ID is invalid', async () => {
      await expect(service.revertOrderStocks(undefined as any)).rejects.toThrow(
        'Invalid order ID',
      );
    });

    it('should throw if book update fails', async () => {
      mockPrismaService.orderItem.findMany.mockResolvedValueOnce([
        {
          bookId: 'booki-uuid-10',
          quantity: 2,
        },
      ]);
      mockPrismaService.book.update.mockRejectedValue(new Error('DB error'));

      await expect(service.revertOrderStocks(orderId1)).rejects.toThrow(
        `Stock counts could not be reverted for Order ${orderId1}.`,
      );

      expect(mockPrismaService.orderItem.findMany).toHaveBeenCalledWith({
        where: { orderId: orderId1 },
      });

      expect(mockPrismaService.book.update).toHaveBeenCalledWith({
        where: { id: 'booki-uuid-10' },
        data: { stockQuantity: { increment: 2 } },
      });
    });
  });

  describe('transformToOrderItem', () => {
    it('should transform valid order item to OrderItemDTO', async () => {
      const result = await service['transformToOrderItem']({
        quantity: 3,
        book: {
          id: bookId,
          title: 'Test Book',
          description: 'test book description',
          isbn: 'book-isbn',
          price: 21.25,
          rating: 4.0,
          imageUrl: 'book-image-url',
          author: { name: 'Traveller Hobbit' },
          category: { id: 1, name: 'test category' },
        },
      });
      expect(result).toEqual(
        new OrderItemDTO(
          new BookDTO(
            bookId,
            'Test Book',
            'test book description',
            'book-isbn',
            { name: 'Traveller Hobbit' },
            new CategoryDTO(1, 'test category'),
            21.25,
            4.0,
            'book-image-url',
          ),
          3,
        ),
      );
    });

    it('should throw when OrderItemDTO validation fails', async () => {
      jest.spyOn(classValidator, 'validate').mockResolvedValueOnce([
        {
          property: 'quantity',
          constraints: { isInt: 'quantity must be an integer' },
        },
      ] as any);

      await expect(
        service['transformToOrderItem']({
          quantity: 1,
          book: {
            id: bookId,
            title: 'Test Book',
            description: 'test book description',
            isbn: 'book-isbn',
            price: 21.25,
            rating: 4.0,
            imageUrl: 'book-image-url',
            author: { name: 'Traveller Hobbit' },
            category: { id: 1, name: 'test category' },
          },
        }),
      ).rejects.toThrow('Validation failed.');
    });
  });

  describe('transformToOrder', () => {
    it('should transform full order to OrderDTO', async () => {
      const result = await service['transformToOrder'](mockPrismaOrder1);
      expect(result).toEqual({
        id: orderId1,
        owner: userId,
        status: 'pending',
        price: 21.25,
        items: [
          new OrderItemDTO(
            new BookDTO(
              bookId,
              'Test Book',
              'test book description',
              'book-isbn',
              { name: 'Traveller Hobbit' },
              new CategoryDTO(1, 'test category'),
              21.25,
              4.0,
              'book-image-url',
            ),
            1,
          ),
        ],
      });
    });
    it('should throw when OrderDTO validation fails', async () => {
      jest
        .spyOn(classValidator, 'validate')
        .mockResolvedValueOnce([]) // no validation errors for items
        .mockResolvedValueOnce([
          {
            property: 'price',
            constraints: { isNumber: 'price must be a number' },
          },
        ] as any); // simulate validation failure for OrderDTO
      await expect(
        service['transformToOrder'](mockPrismaOrder1),
      ).rejects.toThrow('Order transformation failed.');
    });
  });
});
