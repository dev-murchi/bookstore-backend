import { Test, TestingModule } from '@nestjs/testing';
import {
  StripePaymentData,
  StripeSessionData,
  StripeWebhookProcessor,
} from './stripe-webhook-queue.processor';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../payment/stripe/stripe.service';
import { PaymentService } from '../payment/payment.service';
import { OrdersService } from '../orders/orders.service';
import { ShippingService } from '../orders/shipping/shipping.service';
import { PaymentStatus } from '../common/enum/payment-status.enum';
import { EmailService } from '../email/email.service';
import { OrderStatus } from '../common/enum/order-status.enum';
import { RefundStatus } from '../common/enum/refund-status.enum';

const mockPrismaService = {
  $transaction: jest.fn((fn) => fn()),
  refund: { create: jest.fn(), update: jest.fn() },
};

const mockOrdersService = {
  getOrder: jest.fn(),
  revertOrderStocks: jest.fn(),
  updateStatus: jest.fn(),
};
const mockPaymentService = {
  createOrUpdatePayment: jest.fn(),
};
const mockShippingService = {
  createShipping: jest.fn(),
  findByOrder: jest.fn(),
};

const mockStripeService = {
  createRefundForPayment: jest.fn(),
};

const mockEmailService = {
  sendOrderStatusChangeMail: jest.fn(),
  sendRefundStatusChangeMail: jest.fn(),
};

describe('StripeWebhookProcessor', () => {
  let processor: StripeWebhookProcessor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhookProcessor,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: ShippingService, useValue: mockShippingService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    processor = module.get<StripeWebhookProcessor>(StripeWebhookProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('paymentFailed', () => {
    it('should upsert payment with correct data', async () => {
      const data: StripePaymentData = {
        id: 'pi_123',
        object: 'payment_intent',
        amount: 1000,
        last_payment_error: {
          message: 'Your card has insufficient funds.',
        },
        metadata: { orderId: 'order-uuid-123' },
        status: 'requires_payment_method',
      };
      mockPaymentService.createOrUpdatePayment.mockResolvedValueOnce({});

      await (processor as any).paymentFailed(data);

      expect(mockPaymentService.createOrUpdatePayment).toHaveBeenCalledWith({
        orderId: 'order-uuid-123',
        transactionId: 'pi_123',
        status: PaymentStatus.Failed,
        amount: 1000,
      });
    });

    it('should throw errors gracefully', async () => {
      const data: StripePaymentData = {
        id: 'pi_123',
        metadata: { orderId: 'order-uuid-123' },
        last_payment_error: { message: 'Payment failed' },
        amount: 1000,
        object: 'payment_intent',
        status: 'requires_payment_method',
      };

      mockPaymentService.createOrUpdatePayment.mockRejectedValueOnce(
        new Error('Payment upsert error'),
      );

      await expect((processor as any).paymentFailed(data)).rejects.toThrow(
        new Error('Payment failure handling failed for Order order-uuid-123.'),
      );
    });
  });

  describe('paymentExpired', () => {
    it('should update order status as "expired" and update stock count of order items', async () => {
      const data: StripeSessionData = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: 'order-uuid-123' },
        amount_total: 1000,
        currency: 'usd',
        payment_status: 'unpaid',
        status: 'expired',
        customer_details: {
          address: {
            city: 'Test City',
            country: 'Test Country',
            line1: 'address line 1',
            line2: 'address line 2',
            postal_code: 'POSTAL_CODE',
            state: 'Test State',
          },
          email: 'user@email.com',
        },
      };

      const orderItems = [
        {
          id: 1,
          quantity: 1,
          book: {
            id: 1,
            title: 'Test Book 1',
            author: { name: 'Test Author One' },
          },
        },
        {
          id: 2,
          quantity: 2,
          book: {
            id: 2,
            title: 'Test Book 2',
            author: { name: 'Test Author Two' },
          },
        },
      ];

      const existingOrder = {
        orderItems: orderItems,
        id: 1,
        orderId: 'order-uuid-123',
        status: 'pending',
        userId: 1,
        totalPrice: 1000,
        shippingDetails: null,
      };

      mockOrdersService.getOrder.mockResolvedValueOnce(existingOrder);
      mockOrdersService.revertOrderStocks.mockResolvedValueOnce({});
      mockOrdersService.updateStatus.mockResolvedValueOnce({});
      mockPaymentService.createOrUpdatePayment.mockResolvedValueOnce({});

      const consoleSpy = jest.spyOn(console, 'warn');

      await (processor as any).paymentExpired(data);

      expect(mockOrdersService.getOrder).toHaveBeenCalledWith('order-uuid-123');
      expect(mockOrdersService.revertOrderStocks).toHaveBeenCalledWith(
        'order-uuid-123',
      );
      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
        'order-uuid-123',
        OrderStatus.Expired,
      );
      expect(mockPaymentService.createOrUpdatePayment).toHaveBeenCalledWith({
        orderId: 'order-uuid-123',
        transactionId: null,
        status: PaymentStatus.Unpaid,
        amount: 1000,
      });

      expect(mockEmailService.sendOrderStatusChangeMail).toHaveBeenCalledWith(
        OrderStatus.Expired,
        {
          orderId: 'order-uuid-123',
          username: 'user@email.com',
          email: 'user@email.com',
        },
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'Order #[order-uuid-123] expired and expiration email added to the queue.',
      );
      consoleSpy.mockRestore();
    });

    it('should throw errors gracefully', async () => {
      const data: StripeSessionData = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: 'order-uuid-123' },
        amount_total: 1000,
        currency: 'usd',
        payment_status: 'unpaid',
        status: 'expired',
        customer_details: {
          address: {
            city: 'Test City',
            country: 'Test Country',
            line1: 'address line 1',
            line2: 'address line 2',
            postal_code: 'POSTAL_CODE',
            state: 'Test State',
          },
          email: 'user@email.com',
        },
      };

      mockOrdersService.getOrder.mockRejectedValueOnce(
        new Error('Order not found: 123'),
      );

      await expect((processor as any).paymentExpired(data)).rejects.toThrow(
        new Error(
          'Payment expiration handling failed for Order order-uuid-123.',
        ),
      );
    });
  });

  describe('paymentSuccessful', () => {
    it('should update order status as "complete" and create new shipping instance', async () => {
      const data: StripeSessionData = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: 'order-uuid-123' },
        payment_intent: 'pi_123',
        amount_total: 1000,
        currency: 'usd',
        payment_status: 'paid',
        status: 'complete',
        customer_details: {
          address: {
            city: 'Test City',
            country: 'Test Country',
            line1: 'address line 1',
            line2: 'address line 2',
            postal_code: 'POSTAL_CODE',
            state: 'Test State',
          },
          email: 'user@email.com',
        },
      };

      const orderItems = [
        {
          id: 1,
          quantity: 1,
          book: {
            id: 1,
            title: 'Test Book 1',
            author: { name: 'Test Author One' },
          },
        },
        {
          id: 2,
          quantity: 2,
          book: {
            id: 2,
            title: 'Test Book 2',
            author: { name: 'Test Author Two' },
          },
        },
      ];

      const existingOrder = {
        orderItems: orderItems,
        id: 'order-uuid-123',
        status: 'pending',
        userId: 1,
        totalPrice: 1000,
        shippingDetails: null,
      };

      const updatedOrder = {
        orderItems: orderItems,
        id: 'order-uuid-123',
        status: 'complete',
        userId: 1,
        totalPrice: 1000,
        shippingDetails: {
          email: 'user@email.com',
        },
      };

      const shippingDetails = {
        email: data.customer_details.email,
        address: {
          country: 'Test Country',
          state: 'Test State',
          city: 'Test City',
          postalCode: 'POSTAL_CODE',
          line1: 'address line 1',
          line2: 'address line 2',
        },
      };

      const paymentData = {
        orderId: 'order-uuid-123',
        transactionId: 'pi_123',
        status: PaymentStatus.Paid,
        amount: 1000,
      };

      mockOrdersService.getOrder.mockResolvedValueOnce(existingOrder);
      mockOrdersService.updateStatus.mockResolvedValueOnce(updatedOrder);
      mockShippingService.createShipping.mockResolvedValueOnce({});
      mockPaymentService.createOrUpdatePayment.mockResolvedValueOnce({});

      const consoleSpy = jest.spyOn(console, 'warn');

      await (processor as any).paymentSuccessful(data);

      expect(mockOrdersService.getOrder).toHaveBeenCalledWith('order-uuid-123');
      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
        'order-uuid-123',
        OrderStatus.Complete,
      );

      expect(mockShippingService.createShipping).toHaveBeenCalledWith(
        'order-uuid-123',
        shippingDetails,
      );

      expect(mockPaymentService.createOrUpdatePayment).toHaveBeenCalledWith(
        paymentData,
      );

      expect(mockEmailService.sendOrderStatusChangeMail).toHaveBeenCalledWith(
        OrderStatus.Complete,
        {
          orderId: 'order-uuid-123',
          username: 'user@email.com',
          email: 'user@email.com',
        },
      );

      expect(mockStripeService.createRefundForPayment).not.toHaveBeenCalled();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Order #[order-uuid-123] marked as complete and order confirmation email added to queue.',
      );
      consoleSpy.mockRestore();
    });

    it('should throw errors gracefully', async () => {
      const data: StripeSessionData = {
        id: 'cs_123',
        object: 'checkout.session',
        metadata: { orderId: 'order-uuid-123' },
        amount_total: 1000,
        currency: 'usd',
        payment_status: 'paid',
        status: 'complete',
        customer_details: {
          address: {
            city: 'Test City',
            country: 'Test Country',
            line1: 'address line 1',
            line2: 'address line 2',
            postal_code: 'POSTAL_CODE',
            state: 'Test State',
          },
          email: 'user@email.com',
        },
      };
      mockOrdersService.getOrder.mockRejectedValueOnce(
        new Error('Order not found'),
      );

      await expect((processor as any).paymentSuccessful(data)).rejects.toThrow(
        new Error('Payment success handling failed for Order order-uuid-123.'),
      );
    });
  });

  describe('process', () => {
    it('should handle payment_intent.payment_failed event', async () => {
      const job = {
        data: {
          eventType: 'payment_intent.payment_failed',
          eventData: {
            id: 'pi_123',
            object: 'payment_intent',
            amount: 1000,
            last_payment_error: {
              message: 'Your card has insufficient funds.',
            },
            metadata: { orderId: 'order-uuid-123' },
            status: 'requires_payment_method',
          },
        },
      } as any;

      const spy = jest.spyOn(processor as any, 'paymentFailed');
      await processor.process(job);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        id: 'pi_123',
        object: 'payment_intent',
        amount: 1000,
        last_payment_error: {
          message: 'Your card has insufficient funds.',
        },
        metadata: { orderId: 'order-uuid-123' },
        status: 'requires_payment_method',
      });
    });

    it('should handle checkout.session.expired event', async () => {
      const job = {
        data: {
          eventType: 'checkout.session.expired',
          eventData: {
            id: 'cs_123',
            object: 'checkout.session',
            amount_total: 1000,
            metadata: { orderId: 'order-uuid-123' },
            payment_status: 'unpaid',
            status: 'expired',
            customer_details: {
              address: {
                city: 'Test City',
                country: 'Test Country',
                line1: 'address line 1',
                line2: 'address line 2',
                postal_code: 'POSTAL_CODE',
                state: 'Test State',
              },
              email: 'user@email.com',
            },
          },
        },
      } as any;

      const orderItems = [
        {
          id: 1,
          quantity: 1,
          book: {
            id: 1,
            title: 'Test Book 1',
            author: { name: 'Test Author One' },
          },
        },
        {
          id: 2,
          quantity: 2,
          book: {
            id: 2,
            title: 'Test Book 2',
            author: { name: 'Test Author Two' },
          },
        },
      ];

      const existingOrder = {
        orderItems: orderItems,
        id: 1,
        status: 'pending',
        userId: 1,
        totalPrice: 1000,
        shippingDetails: null,
      };

      mockOrdersService.getOrder.mockResolvedValueOnce(existingOrder);

      const spy = jest.spyOn(processor as any, 'paymentExpired');
      await processor.process(job);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        id: 'cs_123',
        object: 'checkout.session',
        amount_total: 1000,
        metadata: { orderId: 'order-uuid-123' },
        payment_status: 'unpaid',
        status: 'expired',
        customer_details: {
          address: {
            city: 'Test City',
            country: 'Test Country',
            line1: 'address line 1',
            line2: 'address line 2',
            postal_code: 'POSTAL_CODE',
            state: 'Test State',
          },
          email: 'user@email.com',
        },
      });
    });

    it('should handle checkout.session.completed event', async () => {
      const job = {
        data: {
          eventType: 'checkout.session.completed',
          eventData: {
            id: 'cs_123',
            metadata: { orderId: 'order-uuid-123' },
            payment_intent: 'pi_123',
            amount_total: 1000,
            payment_status: 'paid',
            status: 'complete',
            customer_details: {
              address: {
                city: 'Test City',
                country: 'Test Country',
                line1: 'address line 1',
                line2: 'address line 2',
                postal_code: 'POSTAL_CODE',
                state: 'Test State',
              },
              email: 'user@email.com',
            },
          },
        },
      } as any;

      const orderItems = [
        {
          id: 1,
          quantity: 1,
          book: {
            id: 1,
            title: 'Test Book 1',
            author: { name: 'Test Author One' },
          },
        },
        {
          id: 2,
          quantity: 2,
          book: {
            id: 2,
            title: 'Test Book 2',
            author: { name: 'Test Author Two' },
          },
        },
      ];

      const existingOrder = {
        orderItems: orderItems,
        id: 1,
        status: 'pending',
        userId: 1,
        totalPrice: 1000,
        shippingDetails: null,
      };

      mockOrdersService.getOrder.mockResolvedValueOnce(existingOrder);

      const spy = jest.spyOn(processor as any, 'paymentSuccessful');
      await processor.process(job);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({
        id: 'cs_123',
        metadata: { orderId: 'order-uuid-123' },
        payment_intent: 'pi_123',
        amount_total: 1000,
        payment_status: 'paid',
        status: 'complete',
        customer_details: {
          address: {
            city: 'Test City',
            country: 'Test Country',
            line1: 'address line 1',
            line2: 'address line 2',
            postal_code: 'POSTAL_CODE',
            state: 'Test State',
          },
          email: 'user@email.com',
        },
      });
    });

    it('should handle refund.created event', async () => {
      const job = {
        data: {
          eventType: 'refund.created',
          eventData: {
            id: 're_123',
            payment_intent: 'pi_123',
            amount: 1000,
            status: 'pending',
            metadata: { orderId: 'order-uuid-123' },
          },
        },
      } as any;

      mockShippingService.findByOrder.mockResolvedValue({
        name: 'John Doe',
        email: 'user@email.com',
      });

      const spy = jest.spyOn(processor as any, 'refundCreated');
      await processor.process(job);

      expect(spy).toHaveBeenCalledWith(job.data.eventData);
    });

    it('should handle refund.updated event', async () => {
      const job = {
        data: {
          eventType: 'refund.updated',
          eventData: {
            id: 're_456',
            status: 'succeeded',
          },
        },
      } as any;

      mockPrismaService.refund.update.mockResolvedValueOnce({
        orderId: 'order-uuid-123',
      });

      mockShippingService.findByOrder.mockResolvedValue({
        name: 'John Doe',
        email: 'user@email.com',
      });

      const spy = jest.spyOn(processor as any, 'refundUpdated');
      await processor.process(job);

      expect(spy).toHaveBeenCalledWith(job.data.eventData);
    });

    it('should handle refund.failed event', async () => {
      const job = {
        data: {
          eventType: 'refund.failed',
          eventData: {
            id: 're_789',
            status: 'failed',
            failure_reason: 'bank_account_closed',
          },
        },
      } as any;

      mockPrismaService.refund.update.mockResolvedValueOnce({
        orderId: 'order-uuid-123',
      });

      mockShippingService.findByOrder.mockResolvedValue({
        name: 'John Doe',
        email: 'user@email.com',
      });

      const spy = jest.spyOn(processor as any, 'refundFailed');
      await processor.process(job);

      expect(spy).toHaveBeenCalledWith(job.data.eventData);
    });

    it('should log unhandled event types', async () => {
      const consoleSpy = jest.spyOn(console, 'warn');
      const job = {
        data: {
          eventType: 'unhandled_event',
          eventData: {},
        },
      } as any;

      await (processor as any).process(job);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Unhandled Stripe webhook event: unhandled_event',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('refundCreated', () => {
    it('should create a refund and send email', async () => {
      const refundData = {
        id: 're_123',
        payment_intent: 'pi_123',
        amount: 1000,
        status: 'pending',
        metadata: { orderId: 'order-uuid-123' },
      } as any;

      mockShippingService.findByOrder.mockResolvedValue({
        email: 'user@email.com',
        name: 'John Doe',
      });

      await (processor as any).refundCreated(refundData);

      expect(mockPrismaService.refund.create).toHaveBeenCalledWith({
        data: {
          refundId: 're_123',
          orderId: 'order-uuid-123',
          transactionId: 'pi_123',
          amount: 1000,
          status: 'pending',
        },
      });

      expect(mockShippingService.findByOrder).toHaveBeenCalledWith(
        'order-uuid-123',
      );

      expect(mockEmailService.sendRefundStatusChangeMail).toHaveBeenCalledWith(
        RefundStatus.RefundCreated,
        {
          orderId: 'order-uuid-123',
          username: 'John Doe',
          email: 'user@email.com',
        },
      );
    });

    it('should log error if orderId is missing', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await (processor as any).refundCreated({
        id: 're_123',
        payment_intent: 'pi_123',
        amount: 1000,
        status: 'pending',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Missing orderId in refund metadata for refund re_123',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('refundUpdated', () => {
    it('should update refund and send success email if succeeded', async () => {
      mockPrismaService.refund.update.mockResolvedValueOnce({
        orderId: 'order-uuid-123',
      });

      mockShippingService.findByOrder.mockResolvedValue({
        name: 'John Doe',
        email: 'user@email.com',
      });

      await (processor as any).refundUpdated({
        id: 're_123',
        status: 'succeeded',
      });

      expect(mockPrismaService.refund.update).toHaveBeenCalledWith({
        where: { refundId: 're_123' },
        data: { status: 'succeeded' },
        select: { orderId: true },
      });

      expect(mockShippingService.findByOrder).toHaveBeenCalledWith(
        'order-uuid-123',
      );

      expect(mockEmailService.sendRefundStatusChangeMail).toHaveBeenCalledWith(
        RefundStatus.RefundComplete,
        {
          orderId: 'order-uuid-123',
          username: 'John Doe',
          email: 'user@email.com',
        },
      );
    });
  });

  describe('refundFailed', () => {
    it('should update refund as failed and send failed email', async () => {
      mockPrismaService.refund.update.mockResolvedValueOnce({
        orderId: 'order-uuid-123',
      });

      mockShippingService.findByOrder.mockResolvedValue({
        name: 'John Doe',
        email: 'user@email.com',
      });

      await (processor as any).refundFailed({
        id: 're_123',
        status: 'failed',
        failure_reason: 'bank_account_closed',
      });

      expect(mockPrismaService.refund.update).toHaveBeenCalledWith({
        where: { refundId: 're_123' },
        data: {
          status: 'failed',
          failureReason: 'bank_account_closed',
        },
        select: { orderId: true },
      });

      expect(mockShippingService.findByOrder).toHaveBeenCalledWith(
        'order-uuid-123',
      );

      expect(mockEmailService.sendRefundStatusChangeMail).toHaveBeenCalledWith(
        RefundStatus.RefundFailed,
        {
          orderId: 'order-uuid-123',
          username: 'John Doe',
          email: 'user@email.com',
        },
      );
    });
  });
});
