import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';

import { OrdersStatusService } from './orders-status.service';
import { OrdersService } from './orders.service';
import { StripeService } from 'src/payment/stripe/stripe.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { QueueService } from 'src/queue/queue.service';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { RoleEnum } from 'src/common/enum/role.enum';
import { OrderStatus } from 'src/common/enum/order-status.enum';
import { CustomAPIError } from 'src/common/errors/custom-api.error';

const mockOrdersService = {
  getOrder: jest.fn(),
  getAll: jest.fn(),
  getUserOrders: jest.fn(),
};
const mockOrdersStatusService = {
  deliverOrder: jest.fn(),
  shipOrder: jest.fn(),
  cancelOrder: jest.fn(),
};
const mockQueueService = {
  addOrderMailJob: jest.fn(),
};
const mockStripeService = {
  createRefundForPayment: jest.fn(),
};

describe('OrdersController', () => {
  let controller: OrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: OrdersStatusService, useValue: mockOrdersStatusService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: StripeService, useValue: mockStripeService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ handleRequest: jest.fn() })
      .compile();

    controller = module.get<OrdersController>(OrdersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('updateOrderStatus', () => {
    const orderId = 'order-uuid';
    const owner = { email: 'test@example.com', name: 'Test User' };

    it('should throw BadRequestException for invalid status', async () => {
      const payload = { status: 'unknown' as OrderStatus };

      try {
        await controller.updateOrderStatus(orderId, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid order status.');
      }
    });

    it('should throw BadrequestException when order current order status is not suitable for the requested status change', async () => {
      const payload = { status: OrderStatus.Shipped };
      mockOrdersStatusService.shipOrder.mockRejectedValueOnce(
        new CustomAPIError(
          `Order must be in '${OrderStatus.Complete}' status to change to '${OrderStatus.Shipped}'. Current: '${OrderStatus.Pending}'`,
        ),
      );

      try {
        await controller.updateOrderStatus(orderId, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          `Order must be in '${OrderStatus.Complete}' status to change to '${OrderStatus.Shipped}'. Current: '${OrderStatus.Pending}'`,
        );
      }
    });

    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      const payload = { status: OrderStatus.Canceled };
      mockOrdersStatusService.cancelOrder.mockRejectedValueOnce(
        new Error('Unknown Error'),
      );
      try {
        await controller.updateOrderStatus(orderId, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          `Failed to update order #${orderId} as ${payload.status} due to unexpected error.`,
        );
      }
    });

    it('should update status to delivered and send email', async () => {
      const payload = { status: OrderStatus.Delivered };
      const updatedOrder = {
        id: orderId,
        owner,
        status: OrderStatus.Delivered,
      };

      mockOrdersStatusService.deliverOrder.mockResolvedValueOnce(updatedOrder);
      mockQueueService.addOrderMailJob.mockResolvedValueOnce({});

      const result = await controller.updateOrderStatus(orderId, payload);

      expect(result).toEqual(updatedOrder);
      expect(mockOrdersStatusService.deliverOrder).toHaveBeenCalledWith(
        orderId,
      );
      expect(mockQueueService.addOrderMailJob).toHaveBeenCalledWith(
        'orderDelivered',
        {
          orderId,
          email: owner.email,
          username: owner.name,
        },
      );
    });

    it('should update status to shipped and send email', async () => {
      const payload = { status: OrderStatus.Shipped };
      const updatedOrder = {
        id: orderId,
        owner,
        status: OrderStatus.Shipped,
      };

      mockOrdersStatusService.shipOrder.mockResolvedValueOnce(updatedOrder);
      mockQueueService.addOrderMailJob.mockResolvedValueOnce({});

      const result = await controller.updateOrderStatus(orderId, payload);

      expect(result).toEqual(updatedOrder);
      expect(mockOrdersStatusService.shipOrder).toHaveBeenCalledWith(orderId);
      expect(mockQueueService.addOrderMailJob).toHaveBeenCalledWith(
        'orderShipped',
        {
          orderId,
          email: owner.email,
          username: owner.name,
        },
      );
    });

    it('should update status to canceled and send email', async () => {
      const payload = { status: OrderStatus.Canceled };
      const updatedOrder = {
        id: orderId,
        owner,
        status: OrderStatus.Canceled,
      };
      mockOrdersStatusService.cancelOrder.mockResolvedValueOnce(updatedOrder);
      mockQueueService.addOrderMailJob.mockResolvedValueOnce({});

      const result = await controller.updateOrderStatus(orderId, payload);

      expect(result).toEqual(updatedOrder);
      expect(mockOrdersStatusService.cancelOrder).toHaveBeenCalledWith(orderId);
      expect(mockQueueService.addOrderMailJob).toHaveBeenCalledWith(
        'orderCanceled',
        {
          orderId,
          email: owner.email,
          username: owner.name,
        },
      );
    });

    it('should not send email if template not found', async () => {
      const payload = { status: OrderStatus.Delivered };
      const updatedOrder = {
        id: orderId,
        owner,
        status: OrderStatus.Delivered,
      };

      mockOrdersStatusService.deliverOrder.mockResolvedValueOnce(updatedOrder);
      mockQueueService.addOrderMailJob.mockResolvedValueOnce({});

      // Remove template to simulate missing template
      controller['orderStatusToEmailTemplateMap'].delete(OrderStatus.Delivered);

      const result = await controller.updateOrderStatus(orderId, payload);
      expect(result).toEqual(updatedOrder);
      expect(mockQueueService.addOrderMailJob).not.toHaveBeenCalled();
    });
  });

  describe('viewAllOrders', () => {
    const adminReq = { user: { role: RoleEnum.Admin, id: 'admin-id' } } as any;
    const userReq = { user: { role: RoleEnum.User, id: 'user-uuid-1' } } as any;

    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockOrdersService.getAll.mockRejectedValueOnce(
        new Error('Unknown Error'),
      );

      try {
        await controller.viewAllOrders(adminReq);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe('Failed to retrieve the orders.');
      }
    });

    it('should return all orders for admin', async () => {
      const orders = [
        {
          id: 'order-uuid-1',
          owner: {
            id: 'user-uuid-1',
            name: 'user one',
            email: 'userone@email.com',
          },
        },
        {
          id: 'order-uuid-2',
          owner: {
            id: 'user-uuid-2',
            name: 'user two',
            email: 'usertwo@email.com',
          },
        },
      ];
      mockOrdersService.getAll.mockResolvedValueOnce(orders);
      const result = await controller.viewAllOrders(adminReq);
      expect(result).toEqual(orders);
      expect(mockOrdersService.getAll).toHaveBeenCalled();
      expect(mockOrdersService.getUserOrders).not.toHaveBeenCalled();
    });

    it('should return user orders for user', async () => {
      const orders = [
        {
          id: 'order-uuid-1',
          owner: {
            id: 'user-uuid-1',
            name: 'user one',
            email: 'userone@email.com',
          },
        },
      ];
      mockOrdersService.getUserOrders.mockResolvedValueOnce(orders);
      const result = await controller.viewAllOrders(userReq);
      expect(result).toEqual(orders);
      expect(mockOrdersService.getAll).not.toHaveBeenCalled();
      expect(mockOrdersService.getUserOrders).toHaveBeenCalledWith(
        'user-uuid-1',
      );
    });
  });

  describe('viewOrder', () => {
    const orderId = 'order-uuid-1';
    const adminReq = { user: { role: RoleEnum.Admin, id: 'admin-id' } } as any;
    const userReq = { user: { role: RoleEnum.User, id: 'user-uuid-1' } } as any;
    const order = {
      id: orderId,
      owner: {
        id: 'user-uuid-1',
        name: 'user one',
        email: 'userone@email.com',
      },
    };

    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockOrdersService.getOrder.mockRejectedValueOnce(
        new Error('Unknown Error'),
      );

      try {
        await controller.viewOrder(adminReq, orderId);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'An unexpected error occurred while fetching the order',
        );
      }
    });

    it('should return order for admin', async () => {
      mockOrdersService.getOrder.mockResolvedValueOnce(order);
      const result = await controller.viewOrder(adminReq, orderId);
      expect(result).toEqual({ data: order });
    });

    it('should throw ForbiddenException for unauthorized user', async () => {
      mockOrdersService.getOrder.mockResolvedValueOnce({
        id: orderId,
        owner: {
          id: 'user-uuid-2',
          name: 'user two',
          email: 'usertwo@email.com',
        },
      });

      try {
        await controller.viewOrder(userReq, orderId);
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.message).toBe(
          `You do not have permission to access order ${orderId}`,
        );
      }
    });

    it('should return order for owner', async () => {
      mockOrdersService.getOrder.mockResolvedValueOnce(order);
      const result = await controller.viewOrder(userReq, orderId);
      expect(result).toEqual({ data: order });
    });
  });

  describe('orderRefund', () => {
    const orderId = 'order-uuid';
    const order = {
      id: orderId,
      status: OrderStatus.Complete,
      payment: { transactionId: 'txid' },
    };

    it('should throw NotFoundException if order not found', async () => {
      mockOrdersService.getOrder.mockResolvedValueOnce(null);

      try {
        await controller.orderRefund(orderId);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.message).toBe('Order not found');
      }
    });

    it('should throw BadRequestException if order status is not complete or delivered', async () => {
      mockOrdersService.getOrder.mockResolvedValueOnce({
        ...order,
        status: OrderStatus.Pending,
      });

      try {
        await controller.orderRefund(orderId);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          `Order status must be ${OrderStatus.Complete} or ${OrderStatus.Delivered} to process a refund`,
        );
      }
    });

    it('should throw InternalServerErrorException when unknown error occurs', async () => {
      mockOrdersService.getOrder.mockResolvedValueOnce(order);

      mockStripeService.createRefundForPayment.mockRejectedValueOnce(
        new Error('Unknown Error'),
      );

      try {
        await controller.orderRefund(orderId);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Refund could not be processed. Please try again later.',
        );
      }
    });

    it('should process refund for complete order', async () => {
      mockOrdersService.getOrder.mockResolvedValueOnce(order);
      const refundData = {
        id: 'refundid',
        amount: 4999,
        currency: 'usd',
        created: Math.floor(Date.now() / 1000),
        status: 'succeeded',
      };
      mockStripeService.createRefundForPayment.mockResolvedValueOnce(
        refundData,
      );
      const result = await controller.orderRefund(orderId);
      expect(result).toEqual({
        status: 'success',
        message: 'Refund processed successfully.',
        refund: {
          refundId: refundData.id,
          orderId,
          amount: Number((refundData.amount / 100).toFixed(2)),
          currency: refundData.currency.toUpperCase(),
          refundedAt: new Date(refundData.created * 1000).toISOString(),
          status: refundData.status,
        },
      });
      expect(mockStripeService.createRefundForPayment).toHaveBeenCalledWith(
        'txid',
        { orderId },
      );
    });

    it('should process refund for delivered order', async () => {
      const deliveredOrder = { ...order, status: OrderStatus.Delivered };
      const refundData = {
        id: 'refundid2',
        amount: 4999,
        currency: 'usd',
        created: Math.floor(Date.now() / 1000),
        status: 'succeeded',
      };
      mockOrdersService.getOrder.mockResolvedValueOnce(deliveredOrder);
      mockStripeService.createRefundForPayment.mockResolvedValueOnce(
        refundData,
      );
      const result = await controller.orderRefund(orderId);

      expect(result).toEqual({
        status: 'success',
        message: 'Refund processed successfully.',
        refund: {
          refundId: refundData.id,
          orderId,
          amount: Number((refundData.amount / 100).toFixed(2)),
          currency: refundData.currency.toUpperCase(),
          refundedAt: new Date(refundData.created * 1000).toISOString(),
          status: refundData.status,
        },
      });
    });
  });
});
