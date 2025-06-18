import { Test, TestingModule } from '@nestjs/testing';
import { CheckoutService } from './checkout.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { PaymentService } from '../../payment/payment.service';
import { CustomAPIError } from '../../common/errors/custom-api.error';

const mockUserId = 'user-uuid-1';
const mockGuestCartId = 'abcdef01-2345-6789-abcd-ef0123456789'; // just example
const mockUserCartId = 'abcdef02-2345-6789-abcd-ef0123456789'; // just example

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
    await expect(
      service.checkout(null, { cartId: mockGuestCartId }),
    ).rejects.toThrow('Please check if the cart ID is correct.');
  });

  it('should throw an error if the cart is empty', async () => {
    mockPrismaService.cart.findUnique.mockResolvedValueOnce({ cart_items: [] });
    await expect(
      service.checkout(null, { cartId: mockGuestCartId }),
    ).rejects.toThrow('Please add items to your cart to perform checkout.');
  });
  it('should throw an error if a DB error occurs', async () => {
    mockPrismaService.cart.findUnique.mockRejectedValueOnce(
      new Error('DB error'),
    );
    await expect(
      service.checkout(null, { cartId: mockGuestCartId }),
    ).rejects.toThrow('Checkout failed. Please try again later.');
  });
  it('should throw an error if there is not enough stock for a book', async () => {
    mockPrismaService.cart.findUnique.mockResolvedValueOnce({
      cart_items: [
        {
          quantity: 5,
          book: {
            id: 'book-1',
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

    await expect(
      service.checkout(null, { cartId: mockGuestCartId }),
    ).rejects.toThrow('Not enough stock for book ID: book-1');
  });

  it('should complete checkout for guest user', async () => {
    const session = {
      expires: Math.floor(Date.now() / 1000) + 1800,
      url: 'https://checkout.stripe.com/test-session-url',
    };
    const cartItems = [
      {
        quantity: 2,
        book: {
          id: 'book-1',
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
          id: 'book-2',
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

    mockPrismaService.cart.findUnique.mockResolvedValueOnce({
      cart_items: cartItems,
    });

    mockPrismaService.orders.create.mockResolvedValueOnce({
      id: 'order-uuid-123',
      totalPrice: new Prisma.Decimal(50.0),
      status: 'pending',
    });

    mockPaymentService.createStripeCheckoutSession.mockResolvedValueOnce(
      session,
    );
    mockPrismaService.cart.delete.mockResolvedValueOnce({
      id: mockGuestCartId,
    });

    const result = await service.checkout(null, { cartId: mockGuestCartId });

    expect(result).toEqual({
      order: {
        id: 'order-uuid-123',
        owner: null,
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
      where: { id: mockGuestCartId },
    });
    expect(mockPaymentService.createStripeCheckoutSession).toHaveBeenCalled();
  });

  it('should throw an error whe stripe checkout session creation failed', async () => {
    const cartItems = [
      {
        quantity: 2,
        book: {
          id: 'book-1',
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
          id: 'book-2',
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

    mockPrismaService.cart.findUnique.mockResolvedValueOnce({
      cart_items: cartItems,
    });

    mockPrismaService.orders.create.mockResolvedValueOnce({
      id: 'order-uuid-123',
      totalPrice: new Prisma.Decimal(50.0),
      status: 'pending',
    });

    mockPaymentService.createStripeCheckoutSession.mockRejectedValueOnce(
      new Error('Stripe check session creation failed.'),
    );
    mockPrismaService.cart.delete.mockResolvedValueOnce({
      id: mockGuestCartId,
    });

    try {
      await service.checkout(null, { cartId: mockGuestCartId });
    } catch (error) {
      expect(error).toBeInstanceOf(CustomAPIError);
      expect(error.message).toBe(
        'Failed to create payment session. Please try again later.',
      );
    }
  });

  it('should complete checkout for logged in user', async () => {
    const session = {
      expires: Math.floor(Date.now() / 1000) + 1800,
      url: 'https://checkout.stripe.com/test-session-url',
    };
    const cartItems = [
      {
        quantity: 2,
        book: {
          id: 'book-1',
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
          id: 'book-2',
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

    mockPrismaService.cart.findUnique.mockResolvedValueOnce({
      cart_items: cartItems,
    });

    mockPrismaService.orders.create.mockResolvedValueOnce({
      id: 'order-uuid-123',
      status: 'pending',
      user: {
        name: mockUserId,
        email: 'user@email.com',
      },
    });

    mockPaymentService.createStripeCheckoutSession.mockResolvedValueOnce(
      session,
    );
    mockPrismaService.cart.delete.mockResolvedValueOnce({
      id: mockUserCartId,
    });

    const result = await service.checkout(mockUserId, {
      cartId: mockUserCartId,
    });

    expect(result).toEqual({
      order: {
        id: 'order-uuid-123',
        owner: mockUserId,
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
      where: { id: mockUserCartId },
    });
    expect(mockPaymentService.createStripeCheckoutSession).toHaveBeenCalledWith(
      {
        cancel_url: 'http://localhost:8080/cancel',
        customer_email: 'user@email.com',
        expires_at: expect.any(Number),
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                images: [],
                name: 'Book A',
              },
              unit_amount: 1500,
            },
            quantity: 2,
          },
          {
            price_data: {
              currency: 'usd',
              product_data: {
                images: [],
                name: 'Book B',
              },
              unit_amount: 2000,
            },
            quantity: 1,
          },
        ],
        metadata: {
          orderId: 'order-uuid-123',
        },
        mode: 'payment',
        payment_intent_data: {
          metadata: {
            orderId: 'order-uuid-123',
          },
        },
        payment_method_types: ['card'],
        shipping_address_collection: {
          allowed_countries: ['TR', 'GB', 'US', 'JP'],
        },
        success_url: 'http://localhost:8080/success',
      },
    );
  });
});
