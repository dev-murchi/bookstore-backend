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
          category: { select: { id: true, category_name: true } },
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
              category: { id: 1, category_name: 'test category' },
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
              category: { id: 1, value: 'test category' },
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
              category: { id: 1, category_name: 'test category' },
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
              category: { id: 1, value: 'test category' },
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

    it('should throw an error if cart creation fails', async () => {
      mockPrismaService.cart.create.mockRejectedValueOnce(
        new Error('Database error during create'),
      );

      await expect(service.createCart(null)).rejects.toThrow(
        'Cart creation failed.',
      );
    });

    it('should throw an error if cart upsert fails', async () => {
      mockPrismaService.cart.upsert.mockRejectedValueOnce(
        new Error('Database error during upsert'),
      );

      await expect(service.createCart('user-uuid-1')).rejects.toThrow(
        'Cart creation failed.',
      );
    });
  });

  describe('findCartById', () => {
    it('should return null if cart is not found by ID', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValueOnce(null);
      const result = await service.findCartById(999);
      expect(result).toBeNull();
      expect(mockPrismaService.cart.findUnique).toHaveBeenCalledWith({
        where: { id: 999 },
        select: cartSelect,
      });
    });

    it('should return cart data if found by ID', async () => {
      const mockCart = {
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
              category: { id: 1, category_name: 'test category' },
            },
          },
        ],
      };
      mockPrismaService.cart.findUnique.mockResolvedValueOnce(mockCart);
      const result = await service.findCartById(1);
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
              category: { id: 1, value: 'test category' },
            },
          },
        ],
        totalPrice: 10.99,
      });
    });

    it('should throw an error if findCartBy fails when finding by ID', async () => {
      mockPrismaService.cart.findUnique.mockRejectedValueOnce(
        new Error('Database error'),
      );
      await expect(service.findCartById(1)).rejects.toThrow(
        'Failed to fetch the cart.',
      );
    });
  });

  describe('findCartByUser', () => {
    it('should return null if cart is not found by userId', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValueOnce(null);
      const result = await service.findCartByUser('non-existent-user');
      expect(result).toBeNull();
      expect(mockPrismaService.cart.findUnique).toHaveBeenCalledWith({
        where: { userid: 'non-existent-user' },
        select: cartSelect,
      });
    });

    it('should return cart data if found by userId', async () => {
      const mockCart = {
        id: 1,
        userid: 'user-uuid-1',
        cart_items: [],
      };
      mockPrismaService.cart.findUnique.mockResolvedValueOnce(mockCart);
      const result = await service.findCartByUser('user-uuid-1');
      expect(result).toEqual({
        id: 1,
        owner: 'user-uuid-1',
        items: [],
        totalPrice: 0,
      });
    });

    it('should throw an error if findCartBy fails when finding by user ID', async () => {
      mockPrismaService.cart.findUnique.mockRejectedValueOnce(
        new Error('Database error'),
      );
      await expect(service.findCartByUser('user-uuid-1')).rejects.toThrow(
        'Failed to fetch the cart.',
      );
    });
  });

  describe('findCartAndTransformData', () => {
    it('should throw an error if the cart is not exist', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValueOnce(null);
      const cartId = 1;
      const result = await (service as any).findCartAndTransformData(cartId);
      expect(result).toBeNull();
    });
    it('should handle empty cart items', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValueOnce({
        id: 1,
        userid: 'user-1',
        cart_items: [],
      });

      const result = await (service as any).findCartAndTransformData(1);
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
            category: { id: 1, category_name: 'test category' },
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
            category: { id: 1, category_name: 'test category 2' },
          },
        },
      ];

      mockPrismaService.cart.findUnique.mockResolvedValueOnce({
        id: 1,
        userid: 'user-1',
        cart_items: cartItems,
      });

      const result = await (service as any).findCartAndTransformData(1);
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
              category: { id: 1, value: 'test category' },
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
              category: { id: 1, value: 'test category 2' },
            },
          },
        ],
        totalPrice: 16.98,
      });
    });
  });

  describe('removeItem', () => {
    it('should throw an error if a database error occurs when the user tries to remove a product from the cart', async () => {
      const cartId = 2;
      const data = {
        bookId: 'book-uuid-1',
      };
      mockPrismaService.cart_items.delete.mockRejectedValueOnce('DB error.');

      try {
        await service.removeItem(cartId, data);
      } catch (error) {
        expect(error.message).toBe(
          'Failed to delete item. Check cart and book IDs.',
        );
      }
    });

    it('should remove an item from the cart', async () => {
      const cartId = 1;
      const data = { bookId: 'book-uuid-1' };

      mockPrismaService.cart_items.delete.mockResolvedValueOnce({});

      const result = await service.removeItem(cartId, data);

      expect(result).toEqual({
        message: 'Item successfully deleted.',
      });
    });
  });

  describe('upsertItem', () => {
    it('it should throw an error if the book with the specified id does not exist', async () => {
      mockPrismaService.books.findUnique.mockReturnValueOnce(null);
      const cartId = 1;
      const data = {
        bookId: 'book-uuid-1',
        quantity: 1,
      };

      try {
        await service.upsertItem(cartId, data);
      } catch (error) {
        expect(error.message).toBe('Book ID #book-uuid-1 does not exist.');
      }
    });

    it('it should throw an error if the stock of the book with the specified id is not sufficient', async () => {
      const cartId = 1;
      const data = {
        bookId: 'book-uuid-1',
        quantity: 10,
      };
      mockPrismaService.books.findUnique.mockReturnValueOnce({
        id: 1,
        stock_quantity: 1,
      });

      try {
        await service.upsertItem(cartId, data);
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
      const cartId = 2;
      const data = {
        bookId: 'book-uuid-1',
        quantity: 1,
      };

      try {
        await service.upsertItem(cartId, data);
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
          category: { id: 1, category_name: 'test category' },
        },
      });

      const cartId = 1;
      const result = await service.upsertItem(cartId, {
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
          category: { id: 1, value: 'test category' },
        },
      });
    });

    it('should throw a generic error if an unexpected error occurs during upsert', async () => {
      mockPrismaService.books.findUnique.mockResolvedValueOnce({
        id: 1,
        stock_quantity: 10,
      });
      mockPrismaService.cart_items.upsert.mockRejectedValueOnce(
        new Error('Unexpected database error'),
      );
      const cartId = 1;
      const data = {
        bookId: 'book-uuid-1',
        quantity: 1,
      };

      await expect(service.upsertItem(cartId, data)).rejects.toThrow(
        'Failed to update item. Check input data.',
      );
    });
  });

  describe('claim', () => {
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
              category: { id: 1, category_name: 'test category' },
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
                category: { id: 1, category_name: 'test category' },
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
                category: { id: 1, category_name: 'test category' },
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
              category: { id: 1, category_name: 'test category' },
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
              category: { id: 1, value: 'test category' },
            },
          },
        ],
      });
    });

    it('should throw an error if the cart to be claimed does not exist', async () => {
      // User has an empty cart
      mockPrismaService.cart.findUnique
        .mockResolvedValueOnce({
          id: 1,
          userid: 'user-uuid-1',
          cart_items: [],
        }) // existing user cart
        .mockResolvedValueOnce(null); // guest cart not found

      try {
        await service.claim('user-uuid-1', 999);
      } catch (error) {
        expect(error).toBeInstanceOf(CustomAPIError);
        expect(error.message).toBe('Cart does not exist.');
      }
    });

    it('should claim a guest cart when user has no existing cart', async () => {
      mockPrismaService.cart.findUnique
        .mockResolvedValueOnce(null) // user has no cart
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
                category: { id: 1, category_name: 'test category' },
              },
            },
          ],
        }); // guest cart exists and is a guest cart

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
              category: { id: 1, category_name: 'test category' },
            },
          },
        ],
      });

      const spy = jest.spyOn(service as any, 'cartUpdate');
      const result = await service.claim('user-uuid-1', 2);

      expect(mockPrismaService.cart.delete).not.toHaveBeenCalled(); // No user cart to delete
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
              category: { id: 1, value: 'test category' },
            },
          },
        ],
      });
    });

    it('should throw a generic error if an unexpected error occurs during claim', async () => {
      mockPrismaService.$transaction.mockImplementationOnce(() => {
        throw new Error('Unexpected transaction error');
      });

      await expect(service.claim('user-uuid-1', 1)).rejects.toThrow(
        'Only guest carts can be claimed.',
      );
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

  describe('transformCartItemData', () => {
    it('should correctly transform cart item data', () => {
      const mockPrismaCartItem = {
        quantity: 2,
        book: {
          bookid: 'book-uuid-test',
          title: 'Test Book Title',
          description: 'Test Description',
          isbn: '1234567890',
          price: 25.5,
          rating: 4.0,
          image_url: 'http://example.com/image.jpg',
          author: { name: 'Test Author' },
          category: { id: 5, category_name: 'Fiction' },
        },
      };

      const transformedData = (service as any).transformCartItemData(
        mockPrismaCartItem,
      );

      expect(transformedData).toEqual({
        quantity: 2,
        item: {
          id: 'book-uuid-test',
          title: 'Test Book Title',
          description: 'Test Description',
          isbn: '1234567890',
          price: 25.5,
          rating: 4.0,
          imageUrl: 'http://example.com/image.jpg',
          author: { name: 'Test Author' },
          category: { id: 5, value: 'Fiction' },
        },
      });
    });
  });

  describe('transformCartData', () => {
    it('should correctly transform cart data with multiple items', () => {
      const mockPrismaCart = {
        id: 101,
        userid: 'user-id-test',
        cart_items: [
          {
            quantity: 1,
            book: {
              bookid: 'book-1',
              title: 'Book One',
              description: 'Desc 1',
              isbn: 'isbn1',
              price: 10.0,
              rating: 3.0,
              image_url: 'img1',
              author: { name: 'Author A' },
              category: { id: 1, category_name: 'Cat A' },
            },
          },
          {
            quantity: 2,
            book: {
              bookid: 'book-2',
              title: 'Book Two',
              description: 'Desc 2',
              isbn: 'isbn2',
              price: 5.0,
              rating: 4.0,
              image_url: 'img2',
              author: { name: 'Author B' },
              category: { id: 2, category_name: 'Cat B' },
            },
          },
        ],
      };

      const transformedData = (service as any).transformCartData(
        mockPrismaCart,
      );

      expect(transformedData).toEqual({
        id: 101,
        owner: 'user-id-test',
        totalPrice: 20.0, // (1 * 10.00) + (2 * 5.00) = 10 + 10 = 20
        items: [
          {
            quantity: 1,
            item: {
              id: 'book-1',
              title: 'Book One',
              description: 'Desc 1',
              isbn: 'isbn1',
              price: 10.0,
              rating: 3.0,
              imageUrl: 'img1',
              author: { name: 'Author A' },
              category: { id: 1, value: 'Cat A' },
            },
          },
          {
            quantity: 2,
            item: {
              id: 'book-2',
              title: 'Book Two',
              description: 'Desc 2',
              isbn: 'isbn2',
              price: 5.0,
              rating: 4.0,
              imageUrl: 'img2',
              author: { name: 'Author B' },
              category: { id: 2, value: 'Cat B' },
            },
          },
        ],
      });
    });

    it('should correctly transform cart data with empty items', () => {
      const mockPrismaCart = {
        id: 102,
        userid: 'user-id-empty',
        cart_items: [],
      };

      const transformedData = (service as any).transformCartData(
        mockPrismaCart,
      );

      expect(transformedData).toEqual({
        id: 102,
        owner: 'user-id-empty',
        totalPrice: 0,
        items: [],
      });
    });
  });

  describe('cartCreate', () => {
    it('should call prisma.cart.create with correct parameters', async () => {
      const mockCreatedCart = {
        id: 1,
        userid: null,
        cart_items: [],
      };
      mockPrismaService.cart.create.mockResolvedValueOnce(mockCreatedCart);

      const result = await (service as any).cartCreate(null);
      expect(mockPrismaService.cart.create).toHaveBeenCalledWith({
        data: { userid: null },
        select: cartSelect,
      });
      expect(result).toEqual(mockCreatedCart);
    });
  });

  describe('cartUpsert', () => {
    it('should call prisma.cart.upsert with correct parameters', async () => {
      const mockUpsertedCart = {
        id: 1,
        userid: 'test-user',
        cart_items: [],
      };
      mockPrismaService.cart.upsert.mockResolvedValueOnce(mockUpsertedCart);

      const result = await (service as any).cartUpsert('test-user');
      expect(mockPrismaService.cart.upsert).toHaveBeenCalledWith({
        where: { userid: 'test-user' },
        update: {},
        create: { user: { connect: { userid: 'test-user' } } },
        select: cartSelect,
      });
      expect(result).toEqual(mockUpsertedCart);
    });
  });

  describe('cartUpdate', () => {
    it('should call prisma.cart.update with correct parameters', async () => {
      const mockUpdatedCart = {
        id: 1,
        userid: 'test-user',
        cart_items: [],
      };
      mockPrismaService.cart.update.mockResolvedValueOnce(mockUpdatedCart);

      const condition = { id: 1 };
      const data = { user: { connect: { userid: 'test-user-new' } } }; // Updated data as per service method
      const result = await (service as any).cartUpdate(condition, data);
      expect(mockPrismaService.cart.update).toHaveBeenCalledWith({
        where: condition,
        data: data,
        select: cartSelect,
      });
      expect(result).toEqual(mockUpdatedCart);
    });
  });

  describe('findCartBy', () => {
    it('should call prisma.cart.findUnique with correct parameters and return data', async () => {
      const mockFoundCart = {
        id: 1,
        userid: 'test-user',
        cart_items: [],
      };
      mockPrismaService.cart.findUnique.mockResolvedValueOnce(mockFoundCart);

      const condition = { id: 1 };
      const result = await (service as any).findCartBy(condition);
      expect(mockPrismaService.cart.findUnique).toHaveBeenCalledWith({
        where: condition,
        select: cartSelect,
      });
      expect(result).toEqual(mockFoundCart);
    });

    it('should call prisma.cart.findUnique with correct parameters and return null if not found', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValueOnce(null);

      const condition = { id: 999 };
      const result = await (service as any).findCartBy(condition);
      expect(mockPrismaService.cart.findUnique).toHaveBeenCalledWith({
        where: condition,
        select: cartSelect,
      });
      expect(result).toBeNull();
    });
  });
});
