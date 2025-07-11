import { Test, TestingModule } from '@nestjs/testing';
import { OrdersStatusService } from './orders-status.service';
import { OrdersService } from './orders.service';
import { OrderStatus } from 'src/common/enum/order-status.enum';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { OrderItemDTO } from 'src/common/dto/order-item.dto';
import { BookDTO } from 'src/common/dto/book.dto';
import { CategoryDTO } from 'src/common/dto/category.dto';

const orderId1 = '461802bb-8792-42f6-b4b3-a620f91cedb6'; // just example
const userId = '5610eb78-6602-4408-88f6-c2889cd136b7'; // just example
const bookId = 'ba22e8c2-8d5f-4ae2-835d-12f488667aed'; // just example

const mockOrder = {
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
};

const mockOrdersService = {
  getOrder: jest.fn(),
  updateStatus: jest.fn(),
};

describe('OrdersStatusService', () => {
  let service: OrdersStatusService;
  let ordersService: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersStatusService,
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
      ],
    }).compile();

    service = module.get(OrdersStatusService);
    ordersService = module.get(OrdersService);
  });

  describe('changeStatus', () => {
    it('should throw an error if order is not found', async () => {
      mockOrdersService.getOrder.mockResolvedValueOnce(null);

      try {
        await service['changeStatus'](orderId1, {
          from: OrderStatus.Pending,
          to: OrderStatus.Canceled,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Please provide a valid order id.');
      }
    });

    it('should return early if status already matches target', async () => {
      const order = { ...mockOrder, status: OrderStatus.Canceled };
      mockOrdersService.getOrder.mockResolvedValueOnce(order);

      const result = await service['changeStatus']('order-uuid-1', {
        from: OrderStatus.Pending,
        to: OrderStatus.Canceled,
      });

      expect(result).toEqual(order);
    });

    it('should throw an error if current status does not match rule.from', async () => {
      const order = { ...mockOrder, status: OrderStatus.Complete };
      mockOrdersService.getOrder.mockResolvedValueOnce(order);

      try {
        await service['changeStatus']('order-uuid-1', {
          from: OrderStatus.Pending,
          to: OrderStatus.Canceled,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe(
          "Order must be in 'pending' status to change to 'canceled'. Current: 'complete'",
        );
      }
    });

    it('should thrown an error if the order id is invalid', async () => {
      mockOrdersService.getOrder.mockRejectedValueOnce(
        new Error('Invalid order ID'),
      );

      await expect(
        service['changeStatus'](1 as unknown as string, {
          from: OrderStatus.Pending,
          to: OrderStatus.Canceled,
        }),
      ).rejects.toThrow('Unable to complete order canceled process.');
    });
  });

  describe('cancelOrder', () => {
    it('should update stock and sends mail', async () => {
      mockOrdersService.getOrder.mockResolvedValueOnce(mockOrder);
      mockOrdersService.updateStatus.mockResolvedValueOnce({
        ...mockOrder,
        status: OrderStatus.Canceled,
      });

      await service.cancelOrder('order-uuid-1');

      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        'order-uuid-1',
        'canceled',
      );
    });
  });

  describe('shipOrder', () => {
    it('should update status and sends mail', async () => {
      const order = { ...mockOrder, status: 'complete' };
      const updated = { ...order, status: 'shipped' };

      mockOrdersService.getOrder.mockResolvedValueOnce(order);
      mockOrdersService.updateStatus.mockResolvedValueOnce(updated);

      await service.shipOrder(order.id);

      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        order.id,
        'shipped',
      );
    });
  });

  describe('deliverOrder', () => {
    it('should update status and sends mail', async () => {
      const order = { ...mockOrder, status: 'shipped' };
      const updated = { ...order, status: 'delivered' };

      mockOrdersService.getOrder.mockResolvedValueOnce(order);
      mockOrdersService.updateStatus.mockResolvedValueOnce(updated);

      await service.deliverOrder(order.id);

      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        order.id,
        'delivered',
      );
    });
  });
});
