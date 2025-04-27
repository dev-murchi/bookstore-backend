import { Test, TestingModule } from '@nestjs/testing';
import { OrdersStatusService } from './orders-status.service';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { Queue } from 'bullmq';

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

const mockMailSenderQueue = {
  add: jest.fn(),
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
  let mailQueue: Queue;

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
          provide: 'MailSenderQueue',
          useValue: mockMailSenderQueue,
        },
      ],
    }).compile();

    service = module.get(OrdersStatusService);
    ordersService = module.get(OrdersService);
    prismaService = module.get(PrismaService);
    mailQueue = module.get<Queue>('MailSenderQueue');
  });

  describe('changeStatus', () => {
    it('throws if order is not found', async () => {
      const orderId = 1;
      mockOrdersService.getOrder.mockRejectedValueOnce(
        new Error(`Order not found: ${orderId}`),
      );
      await expect(
        service.changeStatus(orderId, { from: 'pending', to: 'canceled' }),
      ).rejects.toThrow('Order not found');
    });

    it('returns early if status already matches target', async () => {
      const order = { ...mockOrder, status: 'canceled' };
      mockOrdersService.getOrder.mockResolvedValueOnce(order);

      const result = await service.changeStatus(1, {
        from: 'pending',
        to: 'canceled',
      });

      expect(result).toEqual(order);
    });

    it('throws if current status does not match rule.from', async () => {
      const order = { ...mockOrder, status: 'complete' };
      mockOrdersService.getOrder.mockResolvedValueOnce(order);

      await expect(
        service.changeStatus(1, { from: 'pending', to: 'canceled' }),
      ).rejects.toThrow(/must be in 'pending'/);
    });

    it('calls validate if provided', async () => {
      const validate = jest.fn();
      const order = { ...mockOrder, status: 'pending' };
      mockOrdersService.getOrder.mockResolvedValueOnce(order);
      mockOrdersService.updateStatus.mockResolvedValueOnce({
        ...order,
        status: 'canceled',
      });

      await service.changeStatus(1, {
        from: 'pending',
        to: 'canceled',
        validate,
      });

      expect(validate).toHaveBeenCalledWith(order);
    });

    it('calls updateStatus and postUpdate', async () => {
      const postUpdate = jest.fn();
      const order = { ...mockOrder, status: 'pending' };
      const updatedOrder = { ...order, status: 'canceled' };

      mockOrdersService.getOrder.mockResolvedValueOnce(order);
      mockOrdersService.updateStatus.mockResolvedValueOnce(updatedOrder);

      await service.changeStatus(1, {
        from: 'pending',
        to: 'canceled',
        postUpdate,
      });

      expect(ordersService.updateStatus).toHaveBeenCalledWith(1, 'canceled');
      expect(postUpdate).toHaveBeenCalledWith(updatedOrder);
    });
  });

  describe('cancelOrder', () => {
    it('updates stock and sends mail', async () => {
      mockOrdersService.getOrder.mockResolvedValueOnce(mockOrder);
      mockOrdersService.updateStatus.mockResolvedValueOnce({
        ...mockOrder,
        status: 'canceled',
      });

      await service.cancelOrder(1);

      expect(prismaService.books.update).toHaveBeenCalledTimes(2);
      expect(mailQueue.add).toHaveBeenCalledWith('order-status-mail', {
        orderId: 1,
        email: 'user@example.com',
        status: 'canceled',
      });
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
      expect(mailQueue.add).toHaveBeenCalledWith('order-status-mail', {
        orderId: order.id,
        email: order.shipping_details.email,
        status: 'shipped',
      });
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
      expect(mailQueue.add).toHaveBeenCalledWith('order-status-mail', {
        orderId: order.id,
        email: order.shipping_details.email,
        status: 'delivered',
      });
    });
  });
});
