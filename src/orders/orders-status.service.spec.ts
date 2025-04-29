import { Test, TestingModule } from '@nestjs/testing';
import { OrdersStatusService } from './orders-status.service';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from './enum/order-status.enum';
import { EmailService } from '../email/email.service';

const mockOrder = {
  id: 1,
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

const mockEmailService = {
  sendOrderStatusUpdate: jest.fn(),
};

const mockPrismaService = {
  $transaction: jest.fn((fn) => fn()),
  books: {
    update: jest.fn(),
  },
};

describe('OrdersStatusService', () => {
  let service: OrdersStatusService;
  let ordersService: OrdersService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersStatusService,
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get(OrdersStatusService);
    ordersService = module.get(OrdersService);
    prismaService = module.get(PrismaService);
  });

  describe('changeStatus', () => {
    it('throws if order is not found', async () => {
      const orderId = 1;
      mockOrdersService.getOrder.mockRejectedValueOnce(
        new Error(`Order not found: ${orderId}`),
      );
      await expect(
        service.changeStatus(orderId, {
          from: OrderStatus.Pending,
          to: OrderStatus.Canceled,
        }),
      ).rejects.toThrow('Order not found: 1');
    });

    it('returns early if status already matches target', async () => {
      const order = { ...mockOrder, status: OrderStatus.Canceled };
      mockOrdersService.getOrder.mockResolvedValueOnce(order);

      const result = await service.changeStatus(1, {
        from: OrderStatus.Pending,
        to: OrderStatus.Canceled,
      });

      expect(result).toEqual(order);
    });

    it('throws if current status does not match rule.from', async () => {
      const order = { ...mockOrder, status: OrderStatus.Complete };
      mockOrdersService.getOrder.mockResolvedValueOnce(order);

      await expect(
        service.changeStatus(1, {
          from: OrderStatus.Pending,
          to: OrderStatus.Canceled,
        }),
      ).rejects.toThrow(
        "Order must be in 'pending' status to change to 'canceled'. Current: 'complete'",
      );
    });

    it('calls updateStatus and postUpdate', async () => {
      const postUpdate = jest.fn();
      const order = { ...mockOrder, status: OrderStatus.Pending };
      const updatedOrder = { ...order, status: OrderStatus.Canceled };

      mockOrdersService.getOrder.mockResolvedValueOnce(order);
      mockOrdersService.updateStatus.mockResolvedValueOnce(updatedOrder);

      await service.changeStatus(1, {
        from: OrderStatus.Pending,
        to: OrderStatus.Canceled,
        postUpdate,
      });

      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        1,
        OrderStatus.Canceled,
      );
      expect(postUpdate).toHaveBeenCalledWith(updatedOrder);
    });
  });

  describe('cancelOrder', () => {
    it('updates stock and sends mail', async () => {
      mockOrdersService.getOrder.mockResolvedValueOnce(mockOrder);
      mockOrdersService.updateStatus.mockResolvedValueOnce({
        ...mockOrder,
        status: OrderStatus.Canceled,
      });

      await service.cancelOrder(1);

      expect(prismaService.books.update).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendOrderStatusUpdate).toHaveBeenCalledWith(
        1,
        'canceled',
        'user@email.com',
      );
    });
  });

  describe('shipOrder', () => {
    it('updates status and sends mail', async () => {
      const order = { ...mockOrder, status: 'complete' };
      const updated = { ...order, status: 'shipped' };

      mockOrdersService.getOrder.mockResolvedValueOnce(order);
      mockOrdersService.updateStatus.mockResolvedValueOnce(updated);

      await service.shipOrder(order.id);

      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        order.id,
        'shipped',
      );

      expect(mockEmailService.sendOrderStatusUpdate).toHaveBeenCalledWith(
        1,
        'shipped',
        'user@email.com',
      );
    });
  });

  describe('deliverOrder', () => {
    it('updates status and sends mail', async () => {
      const order = { ...mockOrder, status: 'shipped' };
      const updated = { ...order, status: 'delivered' };

      mockOrdersService.getOrder.mockResolvedValueOnce(order);
      mockOrdersService.updateStatus.mockResolvedValueOnce(updated);

      await service.deliverOrder(order.id);

      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        order.id,
        'delivered',
      );
      expect(mockEmailService.sendOrderStatusUpdate).toHaveBeenCalledWith(
        1,
        'delivered',
        'user@email.com',
      );
    });
  });
});
