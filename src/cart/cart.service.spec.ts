import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomAPIError } from '../common/errors/custom-api.error';

const mockPrismaService = {
  books: {
    findUnique: jest.fn(),
  },
  cart: {
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  cart_items: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest
    .fn()
    .mockImplementation((callback) => callback(mockPrismaService)),
};

const testCart = {
  id: 1,
  userid: null,
  cart_items: [
    {
      quantity: 1,
      book: {
        bookid: 'book-uuid-1',
        title: 'Test Book',
        description: 'test book description',
        isbn: 'bookisbn',
        price: 10.99,
        rating: 4.5,
        image_url: 'book-image-url',
        author: { name: 'test author' },
        category: { category_name: 'test category' },
      },
    },
  ],
};

const bookSelect = {
  bookid: true,
  title: true,
  description: true,
  isbn: true,
  price: true,
  rating: true,
  image_url: true,
  author: { select: { name: true } },
  category: { select: { category_name: true } },
};

const cartSelect = {
  id: true,
  userid: true,
  cart_items: {
    orderBy: { bookid: 'asc' },
    select: {
      quantity: true,
      book: {
        select: {
          bookid: true,
          title: true,
          description: true,
          isbn: true,
          price: true,
          rating: true,
          image_url: true,
          author: { select: { name: true } },
          category: { select: { category_name: true } },
        },
      },
    },
  },
};

describe('CartService', () => {
  let service: CartService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);

    // Mock the current date to a fixed value for consistency in the tests
    const fixedDate = new Date('2025-04-24T00:00:00Z'); // Use any fixed date
    jest.spyOn(global, 'Date').mockImplementation(() => fixedDate); // Ensure it returns fixedDate when new Date() is called
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore the original Date implementation
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCart', () => {
    it('should create a new cart for guest user when userId is null', async () => {
      mockPrismaService.cart.create.mockReturnValueOnce({
        id: 1,
        userid: null,
        cart_items: [
          {
            quantity: 1,
            book: {
              bookid: 'book-uuid-1',
              title: 'Test Book',
              description: 'test book description',
              isbn: 'bookisbn',
              price: 10.99,
              rating: 4.5,
              image_url: 'book-image-url',
              author: { name: 'test author' },
              category: { category_name: 'test category' },
            },
          },
        ],
      });

      const result = await service.createCart(null);
      expect(result).toEqual({
        id: 1,
        owner: null,
        items: [
          {
            quantity: 1,
            item: {
              id: 'book-uuid-1',
              title: 'Test Book',
              description: 'test book description',
              isbn: 'bookisbn',
              price: 10.99,
              rating: 4.5,
              imageUrl: 'book-image-url',
              author: { name: 'test author' },
              category: { value: 'test category' },
            },
          },
        ],
        totalPrice: 10.99,
      });
      expect(mockPrismaService.cart.create).toHaveBeenCalledWith({
        data: { userid: null },
        select: cartSelect,
      });
    });

    it('should find or create a cart for a user with userId is provided', async () => {
      mockPrismaService.cart.upsert.mockReturnValueOnce({
        id: 1,
        userid: 'user-uuid-1',
        cart_items: [
          {
            quantity: 2,
            book: {
              bookid: 'book-uuid-1',
              title: 'Test Book',
              description: 'test book description',
              isbn: 'bookisbn',
              price: 10.99,
              rating: 4.5,
              image_url: 'book-image-url',
              author: { name: 'test author' },
              category: { category_name: 'test category' },
            },
          },
        ],
      });

      const result = await service.createCart('user-uuid-1');
      expect(result).toEqual({
        id: 1,
        owner: 'user-uuid-1',
        items: [
          {
            quantity: 2,
            item: {
              id: 'book-uuid-1',
              title: 'Test Book',
              description: 'test book description',
              isbn: 'bookisbn',
              price: 10.99,
              rating: 4.5,
              imageUrl: 'book-image-url',
              author: { name: 'test author' },
              category: { value: 'test category' },
            },
          },
        ],
        totalPrice: 21.98,
      });
      expect(mockPrismaService.cart.upsert).toHaveBeenCalledWith({
        where: { userid: 'user-uuid-1' },
        update: {},
        create: { user: { connect: { userid: 'user-uuid-1' } } },
        select: cartSelect,
      });
    });
  });

  describe('findCart', () => {
    it('should throw an error if the cart is not exist', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValueOnce(null);
      const cartId = 1;
      const result = await service.findCart(cartId);
      expect(result).toBeNull();
    });
    it('should handle empty cart items', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValueOnce({
        id: 1,
        userid: 'user-1',
        cart_items: [],
      });

      const result = await service.findCart(1);
      expect(result).toEqual({
        id: 1,
        owner: 'user-1',
        items: [],
        totalPrice: 0,
      });
    });

    it('should return cart data with items', async () => {
      const cartItems = [
        {
          quantity: 1,
          book: {
            bookid: 'book-uuid-1',
            title: 'Test Book',
            description: 'test book description',
            isbn: 'bookisbn',
            price: 10.99,
            rating: 4.5,
            image_url: 'book-image-url',
            author: { name: 'test author' },
            category: { category_name: 'test category' },
          },
        },
        {
          quantity: 1,
          book: {
            bookid: 'book-uuid-2',
            title: 'Test Book Two',
            description: 'test book 2description',
            isbn: 'bookisbn-2',
            price: 5.99,
            rating: 5,
            image_url: 'book2-image-url',
            author: { name: 'test author two' },
            category: { category_name: 'test category 2' },
          },
        },
      ];

      mockPrismaService.cart.findUnique.mockResolvedValueOnce({
        id: 1,
        userid: 'user-1',
        cart_items: cartItems,
      });

      const result = await service.findCart(1);
      expect(result).toEqual({
        id: 1,
        owner: 'user-1',
        items: [
          {
            quantity: 1,
            item: {
              id: 'book-uuid-1',
              title: 'Test Book',
              description: 'test book description',
              isbn: 'bookisbn',
              price: 10.99,
              rating: 4.5,
              imageUrl: 'book-image-url',
              author: { name: 'test author' },
              category: { value: 'test category' },
            },
          },
          {
            quantity: 1,
            item: {
              id: 'book-uuid-2',
              title: 'Test Book Two',
              description: 'test book 2description',
              isbn: 'bookisbn-2',
              price: 5.99,
              rating: 5,
              imageUrl: 'book2-image-url',
              author: { name: 'test author two' },
              category: { value: 'test category 2' },
            },
          },
        ],
        totalPrice: 16.98,
      });
    });
  });

  describe('removeItem', () => {
    it('should throw an error if a database error occurs when the user tries to remove a product from the cart', async () => {
      const data = {
        cartId: 2,
        bookId: 'book-uuid-1',
      };
      mockPrismaService.cart_items.delete.mockRejectedValueOnce('DB error.');

      try {
        await service.removeItem(data);
      } catch (error) {
        expect(error.message).toBe(
          'Failed to delete item. Check cart and book IDs.',
        );
      }
    });

    it('should remove an item from the cart', async () => {
      const data = { cartId: 1, bookId: 'book-uuid-1' };

      mockPrismaService.cart_items.delete.mockResolvedValueOnce({});

      const result = await service.removeItem(data);

      expect(result).toEqual({
        message: 'Item successfully deleted.',
      });
    });
  });

  describe('upsertItem', () => {
    it('it should throw an error if the book with the specified id does not exist', async () => {
      mockPrismaService.books.findUnique.mockReturnValueOnce(null);
      const data = {
        bookId: 'book-uuid-1',
        cartId: 1,
        quantity: 1,
      };
      const userId = 'user-1';

      try {
        await service.upsertItem(data);
      } catch (error) {
        expect(error.message).toBe('Book ID #book-uuid-1 does not exist.');
      }
    });

    it('it should throw an error if the stock of the book with the specified id is not sufficient', async () => {
      const data = {
        bookId: 'book-uuid-1',
        cartId: 1,
        quantity: 10,
      };
      const userId = 'user-1';
      mockPrismaService.books.findUnique.mockReturnValueOnce({
        id: 1,
        stock_quantity: 1,
      });

      try {
        await service.upsertItem(data);
      } catch (error) {
        expect(error.message).toBe(
          'Insufficient stock for book ID: book-uuid-1',
        );
      }
    });

    it('should throw an error if the user tries to upser an item to a cart that belongs to someone else', async () => {
      mockPrismaService.books.findUnique.mockReturnValueOnce({
        id: 1,
        stock_quantity: 10,
      });
      mockPrismaService.cart_items.upsert.mockRejectedValueOnce(
        'This is not your cart.',
      );
      const userId = 'user-1';
      const data = {
        cartId: 2,
        bookId: 'book-uuid-1',
        quantity: 1,
      };

      try {
        await service.upsertItem(data);
      } catch (error) {
        expect(error.message).toBe('Failed to update item. Check input data.');
      }
    });
    it('should upsert an item in the cart (create or update)', async () => {
      mockPrismaService.books.findUnique.mockResolvedValueOnce({
        id: 1,
        stock_quantity: 10,
      });

      mockPrismaService.cart_items.upsert.mockResolvedValueOnce({
        quantity: 5,
        book: {
          bookid: 'book-uuid-1',
          title: 'Test Book',
          description: 'test book description',
          isbn: 'book-isbn',
          price: 10.99,
          rating: 3.5,
          image_url: 'book-image-url',
          author: { name: 'test author' },
          category: { category_name: 'test category' },
        },
      });

      const result = await service.upsertItem({
        cartId: 1,
        bookId: 'book-uuid-1',
        quantity: 5,
      });

      expect(result).toEqual({
        quantity: 5,
        item: {
          id: 'book-uuid-1',
          title: 'Test Book',
          description: 'test book description',
          isbn: 'book-isbn',
          price: 10.99,
          rating: 3.5,
          imageUrl: 'book-image-url',
          author: { name: 'test author' },
          category: { value: 'test category' },
        },
      });
    });
  });

  describe('attachUser', () => {
    it('should throw an error if the user already has items in the cart', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValueOnce({
        id: 1,
        userid: 'user-uuid-1',
        cart_items: [
          {
            quantity: 1,
            book: {
              bookid: 'book-uuid-1',
              title: 'Test Book',
              description: 'test book description',
              isbn: 'bookisbn',
              price: 10.99,
              rating: 4.5,
              image_url: 'book-image-url',
              author: { name: 'test author' },
              category: { category_name: 'test category' },
            },
          },
        ],
      });

      try {
        await service.claim('user-uuid-1', 2);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('User already has a cart.');
      }
    });

    it('should throw an error if the user tries to claim a cart that is not created by guest user', async () => {
      mockPrismaService.cart.findUnique
        .mockResolvedValueOnce({
          id: 1,
          userid: 'user-uuid-1',
          cart_items: [],
        })
        .mockResolvedValueOnce({
          id: 2,
          userid: 'user-uuid-2',
          cart_items: [
            {
              quantity: 1,
              book: {
                bookid: 'book-uuid-2',
                title: 'Test Book 2',
                description: 'test book 2 description',
                isbn: 'bookisbn-2',
                price: 10.99,
                rating: 4.5,
                image_url: 'book2-image-url',
                author: { name: 'test author' },
                category: { category_name: 'test category' },
              },
            },
          ],
        });

      try {
        await service.claim('user-uuid-1', 2);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Cart is not a guest cart.');
      }
    });

    it('should attach the user to the cart', async () => {
      mockPrismaService.cart.findUnique
        .mockResolvedValueOnce({
          id: 1,
          userid: 'user-uuid-1',
          cart_items: [],
        })
        .mockResolvedValueOnce({
          id: 2,
          userid: null,
          cart_items: [
            {
              quantity: 1,
              book: {
                bookid: 'book-uuid-2',
                title: 'Test Book 2',
                description: 'test book 2 description',
                isbn: 'bookisbn-2',
                price: 10.99,
                rating: 4.5,
                image_url: 'book2-image-url',
                author: { name: 'test author' },
                category: { category_name: 'test category' },
              },
            },
          ],
        });

      mockPrismaService.cart.update.mockResolvedValueOnce({
        id: 2,
        userid: 'user-uuid-1',
        cart_items: [
          {
            quantity: 1,
            book: {
              bookid: 'book-uuid-2',
              title: 'Test Book 2',
              description: 'test book 2 description',
              isbn: 'bookisbn-2',
              price: 10.99,
              rating: 4.5,
              image_url: 'book2-image-url',
              author: { name: 'test author' },
              category: { category_name: 'test category' },
            },
          },
        ],
      });

      const spy = jest.spyOn(service as any, 'cartUpdate');

      const result = await service.claim('user-uuid-1', 2);

      expect(mockPrismaService.cart.delete).toHaveBeenCalledWith({
        where: { userid: 'user-uuid-1' },
      });

      expect(spy).toHaveBeenCalledWith(
        { id: 2 },
        { user: { connect: { userid: 'user-uuid-1' } } },
      );

      expect(result).toEqual({
        id: 2,
        owner: 'user-uuid-1',
        totalPrice: 10.99,
        items: [
          {
            quantity: 1,
            item: {
              id: 'book-uuid-2',
              title: 'Test Book 2',
              description: 'test book 2 description',
              isbn: 'bookisbn-2',
              price: 10.99,
              rating: 4.5,
              imageUrl: 'book2-image-url',
              author: { name: 'test author' },
              category: { value: 'test category' },
            },
          },
        ],
      });
    });
  });

  describe('removeInactiveGuestCarts', () => {
    it('should remove inactive guest carts older than 1 day', async () => {
      const currentDateTime = new Date().getTime();
      const expirationDate = new Date(currentDateTime - 24 * 60 * 60 * 1000); // 1 day ago

      mockPrismaService.cart.deleteMany.mockResolvedValueOnce({ count: 5 });

      const result = await service.removeInactiveGuestCarts();

      expect(result).toEqual({ removed: 5 });
      expect(mockPrismaService.cart.deleteMany).toHaveBeenCalledWith({
        where: {
          userid: null,
          created_at: { lt: expirationDate },
        },
      });
    });

    it('should return 0 if no inactive carts are found', async () => {
      const currentDateTime = new Date().getTime();
      const expirationDate = new Date(currentDateTime - 24 * 60 * 60 * 1000); // 1 day ago

      mockPrismaService.cart.deleteMany.mockResolvedValueOnce({ count: 0 });

      const result = await service.removeInactiveGuestCarts();

      expect(result).toEqual({ removed: 0 });
      expect(mockPrismaService.cart.deleteMany).toHaveBeenCalledWith({
        where: {
          userid: null,
          created_at: { lt: expirationDate },
        },
      });
    });

    it('should throw an error if deleteMany fails', async () => {
      mockPrismaService.cart.deleteMany.mockRejectedValueOnce(
        new Error('Database error'),
      );

      await expect(service.removeInactiveGuestCarts()).rejects.toThrow(
        'Failed to remove inactive guest carts',
      );
    });
  });
});
