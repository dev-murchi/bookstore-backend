import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

const mockPrismaService = {
  cart: {
    upsert: jest.fn(),
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
    it('should create a cart if user with userId is exist', async () => {
      const cartId = 1;
      const userId = 2;
      mockPrismaService.cart.upsert.mockResolvedValueOnce({
        id: cartId,
        userid: userId,
      });

      const result = await service.createCart(userId);
      expect(result).toEqual({ cartId: cartId });
    });
    //   mockPrismaService.cart.upsert.mockRejectedValueOnce('DB Error');
    //   try {
    //     const userId = 1;
    //     await service.createCart(userId);
    //   } catch (error) {
    //     expect(error).toBeInstanceOf(BadRequestException);
    //     expect(error.message).toBe('Invalid user.');
    //   }
    // });
  });

  describe('findCart', () => {
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
      const cartId = 1;
      const data = { bookId: 1, quantity: 2 };
      const newItem = { bookid: 1, quantity: 2 };
      mockPrismaService.cart_items.create.mockResolvedValue(newItem);

      const result = await service.addItem(cartId, data);

      expect(result).toEqual({
        cartId,
        bookId: 1,
        quatity: 2,
      });
    });
  });

  describe('updateItem', () => {
    it('should update the quantity of an item in the cart', async () => {
      const cartId = 1;
      const data = { bookId: 1, quantity: 3 };
      const updatedItem = { bookid: 1, quantity: 3 };
      mockPrismaService.cart_items.update.mockResolvedValue(updatedItem);

      const result = await service.updateItem(cartId, data);

      expect(result).toEqual({
        cartId,
        bookId: 1,
        quantity: 3,
      });
    });
  });

  describe('removeItem', () => {
    it('should remove an item from the cart', async () => {
      const cartId = 1;
      const data = { bookId: 1 };
      const deletedItem = { bookid: 1 };
      mockPrismaService.cart_items.delete.mockResolvedValue(deletedItem);

      const result = await service.removeItem(cartId, data);

      expect(result).toEqual({
        cartId,
        bookId: 1,
        quantity: 0,
      });
    });
  });

  describe('removeItems', () => {
    it('should remove multiple items from the cart', async () => {
      const cartId = 1;
      const data = [{ bookId: 1 }, { bookId: 2 }];
      const deletedItems = [{ bookid: 1 }, { bookid: 2 }];
      mockPrismaService.$transaction.mockResolvedValue(deletedItems);

      const result = await service.removeItems(cartId, data);

      expect(result).toEqual([
        { cartId, bookId: 1, quantity: 0 },
        { cartId, bookId: 2, quantity: 0 },
      ]);
    });
  });

  describe('upsertItem', () => {
    it('should upsert an item in the cart (create or update)', async () => {
      const cartId = 1;
      const data = { bookId: 1, quantity: 5 };
      const upsertedItem = { bookid: 1, quantity: 5 };
      mockPrismaService.cart_items.upsert.mockResolvedValue(upsertedItem);

      const result = await service.upsertItem(cartId, data);

      expect(result).toEqual({
        cartId,
        bookId: 1,
        quatity: 5,
      });
    });
  });

  describe('upsertItems', () => {
    it('should upsert multiple items in the cart (create or update)', async () => {
      const cartId = 1;
      const data = [
        { bookId: 1, quantity: 5 },
        { bookId: 2, quantity: 3 },
      ];
      const upsertedItems = [
        { bookid: 1, quantity: 5 },
        { bookid: 2, quantity: 3 },
      ];
      mockPrismaService.$transaction.mockResolvedValue(upsertedItems);

      const result = await service.upsertItems(cartId, data);

      expect(result).toEqual([
        { cartId, bookId: 1, quantity: 5 },
        { cartId, bookId: 2, quantity: 3 },
      ]);
    });
  });
});
