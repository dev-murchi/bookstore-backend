import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  books: {
    findUnique: jest.fn(),
  },
  cart: {
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  cart_items: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCart', () => {
    it('should create a new cart for guest user when userId is null', async () => {
      mockPrismaService.cart.create.mockReturnValueOnce({
        id: 1,
        userid: null,
      });
      const result = await service.createCart(null);
      expect(result).toEqual({ cartId: 1 });
      expect(mockPrismaService.cart.create).toHaveBeenCalledWith({
        data: { userid: null },
      });
    });

    it('should find or create a cart for a user with userId is provided', async () => {
      const cartId = 1;
      const userId = 2;
      mockPrismaService.cart.upsert.mockResolvedValueOnce({
        id: cartId,
        userid: userId,
      });

      const result = await service.createCart(userId);
      expect(result).toEqual({ cartId: cartId });
      expect(mockPrismaService.cart.upsert).toHaveBeenCalledWith({
        where: { userid: userId },
        update: {},
        create: { userid: userId },
      });
    });
  });

  describe('findCart', () => {
    it('should throw an error if the cart is not exist', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValueOnce(null);
      const cartId = 1;
      try {
        await service.findCart(cartId);
      } catch (error) {
        expect(error.message).toBe('Cart is not exist.');
      }
    });
    it('should handle empty cart items', async () => {
      const cartId = 1;
      const userId = 1;
      mockPrismaService.cart.findUnique.mockResolvedValueOnce({
        userid: userId,
        cart_items: [],
      });

      const result = await service.findCart(cartId);
      expect(result).toEqual({
        cartId,
        userId,
        cartItems: [],
        totalPrice: 0,
      });
    });

    it('should return cart data with items', async () => {
      const cartId = 1;
      const userId = 1;

      const cartItems = [
        {
          quantity: 1,
          book: {
            id: 1,
            title: 'Book Title',
            price: 10.99,
          },
        },
        {
          quantity: 1,
          book: {
            id: 2,
            title: 'Book Title 2',
            price: 10.99,
          },
        },
      ];
      mockPrismaService.cart.findUnique.mockResolvedValueOnce({
        userid: userId,
        cart_items: cartItems,
      });

      const result = await service.findCart(cartId);
      expect(result).toEqual({
        cartId,
        userId,
        cartItems: [
          {
            bookId: 1,
            bookTitle: 'Book Title',
            price: 10.99,
            quantity: 1,
          },
          {
            bookId: 2,
            bookTitle: 'Book Title 2',
            price: 10.99,
            quantity: 1,
          },
        ],
        totalPrice: 21.98,
      });
    });
  });

  describe('addItem', () => {
    it('should add a new item to the cart', async () => {
      const data = { cartId: 1, bookId: 1, quantity: 2 };
      const newItem = { bookid: 1, quantity: 2 };
      mockPrismaService.cart_items.create.mockResolvedValue(newItem);

      const result = await service.addItem(data);

      expect(result).toEqual({
        message: 'Item successfully added.',
      });
    });
  });

  describe('updateItem', () => {
    it('it should throw an error if the book with the specified id does not exist', async () => {
      mockPrismaService.books.findUnique.mockReturnValueOnce(null);
      const data = {
        bookId: 1,
        cartId: 1,
        quantity: 1,
      };
      const userId = 1;

      try {
        await service.updateItem(userId, data);
      } catch (error) {
        expect(error.message).toBe('Book ID #1 is not exist.');
      }
    });

    it('it should throw an error if the stock of the book with the specified id is not sufficient', async () => {
      const data = {
        bookId: 1,
        cartId: 1,
        quantity: 10,
      };
      const userId = 1;
      mockPrismaService.books.findUnique.mockReturnValueOnce({
        id: 1,
        stock_quantity: 1,
      });

      try {
        await service.updateItem(userId, data);
      } catch (error) {
        expect(error.message).toBe('Not enough stock for book ID: 1');
      }
    });

    it('should throw an error if the user tries to update an item to a cart that belongs to someone else', async () => {
      mockPrismaService.cart_items.update.mockRejectedValueOnce(
        'This is not your cart.',
      );
      mockPrismaService.books.findUnique.mockReturnValueOnce({
        id: 1,
        stock_quantity: 10,
      });
      const userId = 1;
      const data = {
        cartId: 2,
        bookId: 1,
        quantity: 1,
      };

      try {
        await service.updateItem(userId, data);
      } catch (error) {
        expect(error.message).toBe(
          'An error occurred while updating the item. Please check if the cart ID and book ID are correct, and ensure the quantity is valid',
        );
      }
    });
    it('should update the quantity of an item in the cart', async () => {
      const data = { cartId: 1, bookId: 1, quantity: 3 };
      const updatedItem = { bookid: 1, quantity: 3 };
      const book = { id: 1, stock_quantity: 10 };
      const userId = 1;

      mockPrismaService.books.findUnique.mockResolvedValueOnce(book);
      mockPrismaService.cart_items.update.mockResolvedValue(updatedItem);

      const result = await service.updateItem(userId, data);

      expect(result).toEqual({
        message: 'Item successfully updated.',
      });
    });
  });

  describe('removeItem', () => {
    it('should throw an error if a database error occurs when the user tries to remove a product from the cart', async () => {
      const userId = 1;
      const data = {
        cartId: 2,
        bookId: 1,
      };
      mockPrismaService.cart_items.delete.mockRejectedValueOnce('DB error.');

      try {
        await service.removeItem(userId, data);
      } catch (error) {
        expect(error.message).toBe(
          'An error occurred while deleting the item. Please check if the cart ID and book ID are correct.',
        );
      }
    });

    it('should remove an item from the cart', async () => {
      const data = { cartId: 1, bookId: 1 };
      const deletedItem = { bookid: 1 };
      const userId = 1;
      mockPrismaService.cart_items.delete.mockResolvedValue(deletedItem);

      const result = await service.removeItem(userId, data);

      expect(result).toEqual({
        message: 'Item successfully deleted.',
      });
    });
  });

  describe('upsertItem', () => {
    it('it should throw an error if the book with the specified id does not exist', async () => {
      mockPrismaService.books.findUnique.mockReturnValueOnce(null);
      const data = {
        bookId: 1,
        cartId: 1,
        quantity: 1,
      };
      const userId = 1;

      try {
        await service.upsertItem(userId, data);
      } catch (error) {
        expect(error.message).toBe('Book ID #1 is not exist.');
      }
    });

    it('it should throw an error if the stock of the book with the specified id is not sufficient', async () => {
      const data = {
        bookId: 1,
        cartId: 1,
        quantity: 10,
      };
      const userId = 1;
      mockPrismaService.books.findUnique.mockReturnValueOnce({
        id: 1,
        stock_quantity: 1,
      });

      try {
        await service.upsertItem(userId, data);
      } catch (error) {
        expect(error.message).toBe('Not enough stock for book ID: 1');
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
      const userId = 1;
      const data = {
        cartId: 2,
        bookId: 1,
        quantity: 1,
      };

      try {
        await service.upsertItem(userId, data);
      } catch (error) {
        expect(error.message).toBe(
          'An error occurred while updating the item. Please check if the cart ID and book ID are correct, and ensure the quantity is valid',
        );
      }
    });
    it('should upsert an item in the cart (create or update)', async () => {
      const data = { cartId: 1, bookId: 1, quantity: 5 };
      const upsertedItem = { bookid: 1, quantity: 5 };
      const book = { id: 1, stock_quantity: 10 };
      const userId = 1;

      mockPrismaService.books.findUnique.mockResolvedValueOnce(book);

      mockPrismaService.cart_items.upsert.mockResolvedValue(upsertedItem);

      const result = await service.upsertItem(userId, data);

      expect(result).toEqual({ message: 'Item successfully updated.' });
    });
  });

  describe('attachUser', () => {
    it('should throw an error if the user already has items in the cart', async () => {
      const userId = 1;
      const cartId = 1;
      mockPrismaService.cart.findUnique.mockResolvedValueOnce({
        cart_items: [
          {
            id: 1,
            bookid: 1,
            cartid: 1,
            quantity: 1,
          },
        ],
      });

      await expect(service.claim(userId, cartId)).rejects.toThrow(
        new Error('User alredy has a cart.'),
      );
    });

    it('should throw an error if the user tries to claim a cart that is not created by guest user', async () => {
      const userId = 1;
      const cartId = 1;
      mockPrismaService.cart.findUnique.mockRejectedValueOnce(
        'cart owner is not guest',
      );

      try {
        await service.claim(userId, cartId);
      } catch (error) {
        expect(error.message).toBe(
          'User can only claim the cart created by the guest.',
        );
      }
    });

    it('should attach the user to the cart', async () => {
      const userId = 1;
      const cartId = 1;
      mockPrismaService.cart.update.mockResolvedValue({ id: 1, userid: 1 });

      const result = await service.claim(userId, cartId);

      expect(result).toEqual({
        message: 'User is attached to the cart.',
      });
    });
  });
});
