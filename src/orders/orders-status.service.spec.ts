import { Test, TestingModule } from '@nestjs/testing';
import { OrdersStatusService } from './orders-status.service';
import { OrdersService } from './orders.service';
import { OrderStatus } from '../common/enum/order-status.enum';
import { CustomAPIError } from '../common/errors/custom-api.error';

const mockOrder = {
  id: 1,
  orderid: 'order-uuid-1',
  userid: 101,
  totalPrice: 42.5,
  status: OrderStatus.Pending,
  shipping_details: { email: 'user@email.com' },
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
    {
      id: 2,
      quantity: 1,
      book: {
        id: 11,
        title: 'Book Title 2',
        author: { name: 'Author Name 2' },
      },
    },
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
    it('throws if order is not found', async () => {
      const orderId = 1;
      mockOrdersService.getOrder.mockResolvedValueOnce(null);

      try {
        await (service as any).changeStatus(orderId, {
          from: OrderStatus.Pending,
          to: OrderStatus.Canceled,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Please provide a valid order id.');
      }
    });

    it('returns early if status already matches target', async () => {
      const order = { ...mockOrder, status: OrderStatus.Canceled };
      mockOrdersService.getOrder.mockResolvedValueOnce(order);

      const result = await (service as any).changeStatus('order-uuid-1', {
        from: OrderStatus.Pending,
        to: OrderStatus.Canceled,
      });

      expect(result).toEqual(order);
    });

    it('throws if current status does not match rule.from', async () => {
      const order = { ...mockOrder, status: OrderStatus.Complete };
      mockOrdersService.getOrder.mockResolvedValueOnce(order);

      try {
        await (service as any).changeStatus('order-uuid-1', {
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
  });

  describe('cancelOrder', () => {
    it('updates stock and sends mail', async () => {
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
    it('updates status and sends mail', async () => {
      const order = { ...mockOrder, status: 'complete' };
      const updated = { ...order, status: 'shipped' };

      mockOrdersService.getOrder.mockResolvedValueOnce(order);
      mockOrdersService.updateStatus.mockResolvedValueOnce(updated);

      await service.shipOrder(order.orderid);

      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        order.orderid,
        'shipped',
      );
    });
  });

  describe('deliverOrder', () => {
    it('updates status and sends mail', async () => {
      const order = { ...mockOrder, status: 'shipped' };
      const updated = { ...order, status: 'delivered' };

      mockOrdersService.getOrder.mockResolvedValueOnce(order);
      mockOrdersService.updateStatus.mockResolvedValueOnce(updated);

      await service.deliverOrder(order.orderid);

      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        order.orderid,
        'delivered',
      );
    });
  });
});
