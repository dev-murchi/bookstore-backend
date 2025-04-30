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
  createStripeCheckoutSession: jest.fn(),
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
    const session = {
      expires: '',
      url: sessionUrl,
    };
    const cartItems = [
      {
        quantity: 1,
        book: {
          id: 1,
          price: new Prisma.Decimal(10.99),
          stock_quantity: 10,
          title: 'Book One',
        },
      },
      {
        quantity: 2,
        book: {
          id: 2,
          price: new Prisma.Decimal(5.99),
          stock_quantity: 10,
          title: 'Book Two',
        },
      },
    ];

    const user = {
      id: 1,
      name: 'user one',
      email: 'userone@email.com',
    };

    const order = {
      user: user,
      order_items: cartItems.map((item) => {
        return {
          quantity: item.quantity,
          book: {
            id: item.book.id,
            price: item.book.price,
            title: item.book.title,
          },
        };
      }),
      id: 1,
      totalPrice: 22.97,
      status: 'pending',
    };
    mockPrismaService.cart.findUnique.mockReturnValueOnce({
      cart_items: cartItems,
    });

    mockPrismaService.orders.create.mockReturnValueOnce(order);

    mockPrismaService.cart.delete.mockReturnValueOnce({ id: 1 });

    mockPaymentService.createStripeCheckoutSession.mockResolvedValueOnce(
      session,
    );

    const result = await service.checkout(userId, { cartId: 1 });

    // check cart.findUnique called with correct data
    expect(mockPrismaService.cart.findUnique).toHaveBeenCalledWith({
      where: { id: 1, AND: [{ userid: 1 }] },
      select: {
        cart_items: {
          select: {
            book: {
              select: {
                id: true,
                title: true,
                price: true,
                stock_quantity: true,
              },
            },
            quantity: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // check orders.create called with correct data
    expect(mockPrismaService.orders.create).toHaveBeenCalledWith({
      data: {
        totalPrice: 22.97,
        status: 'pending',
        userid: 1,
        order_items: {
          createMany: {
            data: [
              { bookid: 1, quantity: 1 },
              { bookid: 2, quantity: 2 },
            ],
          },
        },
      },
      select: {
        id: true,
        totalPrice: true,
        status: true,
        order_items: {
          select: {
            book: {
              select: {
                id: true,
                title: true,
                price: true,
              },
            },
            quantity: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // check books.update called with correct data
    expect(mockPrismaService.books.update).toHaveBeenCalledTimes(
      cartItems.length,
    );

    cartItems.forEach((item, index) => {
      expect(mockPrismaService.books.update).toHaveBeenNthCalledWith(
        index + 1,
        {
          where: { id: item.book.id },
          data: { stock_quantity: { decrement: item.quantity } },
        },
      );
    });

    // check cart.delete called with correct data
    expect(mockPrismaService.cart.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    // check paymentService.createStripeCheckoutSession called with correct data
    expect(mockPaymentService.createStripeCheckoutSession).toHaveBeenCalledWith(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        shipping_address_collection: {
          allowed_countries: ['TR', 'GB', 'US', 'JP'],
        },
        metadata: {
          orderId: 1,
        },
        payment_intent_data: {
          metadata: {
            orderId: 1,
          },
        },
        customer_email: undefined,
        line_items: cartItems.map((item) => ({
          price_data: {
            product_data: {
              name: item.book.title,
            },
            unit_amount: Number(item.book.price.toFixed(2)) * 100,
            currency: 'usd',
          },
          quantity: item.quantity,
        })),
        success_url: 'http://localhost:8080/success',
        cancel_url: 'http://localhost:8080/cancel',
        expires_at: Math.floor(Date.now() / 1000) + 60 * 30,
      },
    );

    // check return value
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
            quantity: 1,
            bookId: 1,
            price: 10.99,
            bookTitle: 'Book One',
          },
          {
            quantity: 2,
            bookId: 2,
            price: 5.99,
            bookTitle: 'Book Two',
          },
        ],
        status: 'pending',
        totalPrice: 22.97,
      },
      message: 'Checkout successfull.',
      expires: '',
      url: sessionUrl,
    });
  });
});
