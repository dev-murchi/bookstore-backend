import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PaymentService } from '../../payment/payment.service';

const mockPrismaService = {
  $transaction: jest
    .fn()
    .mockImplementation((callback) => callback(mockPrismaService)),
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

  it('should throw an error if the cart does not exist', async () => {
    mockPrismaService.cart.findUnique.mockResolvedValueOnce(null);
    await expect(service.checkout('user-1', { cartId: 1 })).rejects.toThrow(
      'Please check if the cart ID is correct.',
    );
  });
  it('should throw an error if a DB error occurs', async () => {
    mockPrismaService.cart.findUnique.mockRejectedValueOnce(
      new Error('DB error'),
    );
    await expect(service.checkout('user-1', { cartId: 1 })).rejects.toThrow(
      'Checkout failed. Please try again later.',
    );
  });
  it('should throw an error if there is not enough stock for a book', async () => {
    mockPrismaService.cart.findUnique.mockResolvedValueOnce({
      cart_items: [
        {
          quantity: 5,
          book: {
            bookid: 'book-1',
            stock_quantity: 2,
            price: new Prisma.Decimal(10.0),
            title: 'Book One',
            description: 'Book Desc',
            isbn: 'ISBN-1',
            rating: new Prisma.Decimal(4.2),
            image_url: '',
            author: { name: 'Author A' },
            category: { id: 1, category_name: 'Fiction' },
          },
        },
      ],
    });

    await expect(service.checkout('user-1', { cartId: 1 })).rejects.toThrow(
      'Not enough stock for book ID: book-1',
    );
  });

  it('should complete checkout and return expected data', async () => {
    const session = {
      expires: Math.floor(Date.now() / 1000) + 1800,
      url: 'https://checkout.stripe.com/test-session-url',
    };
    const cartItems = [
      {
        quantity: 2,
        book: {
          bookid: 'book-1',
          price: new Prisma.Decimal(15.0),
          stock_quantity: 10,
          title: 'Book A',
          description: 'Book A Description',
          isbn: 'ISBN-A',
          rating: new Prisma.Decimal(4.0),
          image_url: 'img-a.jpg',
          author: { name: 'Author A' },
          category: { id: 1, category_name: 'Fiction' },
        },
      },
      {
        quantity: 1,
        book: {
          bookid: 'book-2',
          price: new Prisma.Decimal(20.0),
          stock_quantity: 5,
          title: 'Book B',
          description: 'Book B Description',
          isbn: 'ISBN-B',
          rating: new Prisma.Decimal(4.5),
          image_url: 'img-b.jpg',
          author: { name: 'Author B' },
          category: { id: 2, category_name: 'Non-fiction' },
        },
      },
    ];

    const user = {
      userid: 'user-1',
      email: 'user@example.com',
      name: 'User Name',
    };

    mockPrismaService.cart.findUnique.mockResolvedValueOnce({
      cart_items: cartItems,
    });

    mockPrismaService.orders.create.mockResolvedValueOnce({
      orderid: 'order-uuid-123',
      totalPrice: new Prisma.Decimal(50.0),
      status: 'pending',
    });

    mockPaymentService.createStripeCheckoutSession.mockResolvedValueOnce(
      session,
    );
    mockPrismaService.cart.delete.mockResolvedValueOnce({ id: 1 });

    const result = await service.checkout('user-1', { cartId: 1 });

    expect(result).toEqual({
      order: {
        id: 'order-uuid-123',
        owner: 'user-1',
        items: [
          {
            quantity: 2,
            item: {
              id: 'book-1',
              title: 'Book A',
              description: 'Book A Description',
              isbn: 'ISBN-A',
              price: 15.0,
              rating: 4.0,
              imageUrl: 'img-a.jpg',
              author: { name: 'Author A' },
              category: { id: 1, value: 'Fiction' },
            },
          },
          {
            quantity: 1,
            item: {
              id: 'book-2',
              title: 'Book B',
              description: 'Book B Description',
              isbn: 'ISBN-B',
              price: 20.0,
              rating: 4.5,
              imageUrl: 'img-b.jpg',
              author: { name: 'Author B' },
              category: { id: 2, value: 'Non-fiction' },
            },
          },
        ],
        status: 'pending',
        price: 50.0,
      },
      message: 'Checkout successful.',
      expiresAt: session.expires,
      url: session.url,
    });

    expect(mockPrismaService.orders.create).toHaveBeenCalled();
    expect(mockPrismaService.books.update).toHaveBeenCalledTimes(2);
    expect(mockPrismaService.cart.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(mockPaymentService.createStripeCheckoutSession).toHaveBeenCalled();
  });
});
