import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
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
    it('should update the quantity of an item in the cart', async () => {
      const data = { cartId: 1, bookId: 1, quantity: 3 };
      const updatedItem = { bookid: 1, quantity: 3 };
      const userId = 1;
      mockPrismaService.cart_items.update.mockResolvedValue(updatedItem);

      const result = await service.updateItem(userId, data);

      expect(result).toEqual({
        message: 'Item successfully updated.',
      });
    });
  });

  describe('removeItem', () => {
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
    it('should upsert an item in the cart (create or update)', async () => {
      const data = { cartId: 1, bookId: 1, quantity: 5 };
      const upsertedItem = { bookid: 1, quantity: 5 };
      const userId = 1;
      mockPrismaService.cart_items.upsert.mockResolvedValue(upsertedItem);

      const result = await service.upsertItem(userId, data);

      expect(result).toEqual({ message: 'Item successfully updated.' });
    });
  });

  describe('attachUser', () => {
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
