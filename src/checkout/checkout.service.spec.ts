import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PaymentService } from '../payment/payment.service';

const mockPrismaService = {
  $transaction: jest
    .fn()
    .mockImplementation((callback) => callback(mockPrismaService)),
  cart_items: {
    findMany: jest.fn(),
  },
  orders: {
    create: jest.fn(),
  },
  books: {
    update: jest.fn(),
  },
  cart: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

const mockPaymentService = {
  createCheckoutSession: jest.fn(),
};

const userId = 1;

describe('CheckoutService', () => {
  let service: CheckoutService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PaymentService, useValue: mockPaymentService },
      ],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw an error if the cart is not exist', async () => {
    mockPrismaService.cart.findUnique.mockReturnValueOnce(null);
    await expect(service.checkout(userId, { cartId: 1 })).rejects.toThrow(
      'Please check if the cart ID is correct.',
    );
  });
  it('should throw an error if the cart is not empty', async () => {
    mockPrismaService.cart.findUnique.mockReturnValueOnce({
      cart_items: [],
    });
    await expect(service.checkout(userId, { cartId: 1 })).rejects.toThrow(
      'Your cart is empty. Please add items to your cart.',
    );
  });
  it('should throw an error if there is not enough stock for requested book', async () => {
    mockPrismaService.cart.findUnique.mockReturnValueOnce({
      cart_items: [
        {
          quantity: 20,
          book: {
            id: 1,
            price: 10.0,
            stock_quantity: 10,
          },
        },
      ],
    });

    await expect(service.checkout(userId, { cartId: 1 })).rejects.toThrow(
      'Not enough stock for book ID: 1',
    );
  });

  it('should throw an error if a db error occurs', async () => {
    mockPrismaService.cart.findUnique.mockRejectedValueOnce(
      new Error('DB error'),
    );
    await expect(service.checkout(userId, { cartId: 1 })).rejects.toThrow(
      'Checkout failed. Please try again later.',
    );
  });
  it('should create an order ', async () => {
    const sessionUrl = 'https://checkout.stripe.com/test-session-url';
    mockPrismaService.cart.findUnique.mockReturnValueOnce({
      cart_items: [
        {
          quantity: 2,
          book: {
            id: 1,
            price: new Prisma.Decimal(10.99),
            stock_quantity: 10,
          },
        },
      ],
    });

    mockPrismaService.orders.create.mockReturnValueOnce({
      user: {
        id: 1,
        name: 'user one',
        email: 'userone@email.com',
      },
      order_items: [
        {
          quantity: 2,
          book: {
            id: 1,
            price: new Prisma.Decimal(10.99),
            title: 'Book One',
          },
        },
      ],
      id: 1,
      totalPrice: 21.98,
      status: 'pending',
    });

    mockPrismaService.cart.delete.mockReturnValueOnce({ id: 1 });

    mockPaymentService.createCheckoutSession.mockResolvedValueOnce({
      expires: '',
      url: sessionUrl,
    });

    const result = await service.checkout(userId, { cartId: 1 });
    expect(result).toEqual({
      order: {
        id: 1,
        user: {
          id: 1,
          name: 'user one',
          email: 'userone@email.com',
        },
        items: [
          {
            quantity: 2,
            bookId: 1,
            price: 10.99,
            bookTitle: 'Book One',
          },
        ],
        status: 'pending',
        totalPrice: 21.98,
      },
      message: 'Checkout successfull.',
      expires: '',
      url: sessionUrl,
    });
  });
});
