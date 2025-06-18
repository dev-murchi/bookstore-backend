import { Test, TestingModule } from '@nestjs/testing';
import { CartItemService } from './cart-item.service';
import { PrismaService } from '../prisma/prisma.service';
import * as classValidator from 'class-validator';

const mockCartId = 'abcdef01-2345-6789-abcd-ef0123456789'; // just example

const mockBookId = 'ba22e8c2-8d5f-4ae2-835d-12f488667aed'; // just example
const mockBookId3 = 'ba22e8c2-1234-1234-835d-12f488667aed'; // just example

const mockPrismaService = {
  book: {
    findUnique: jest.fn(),
  },

  cartItem: {
    upsert: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest
    .fn()
    .mockImplementation((callback) => callback(mockPrismaService)),
};

describe('CartItemService', () => {
  let service: CartItemService;
  let validateSpy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartItemService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CartItemService>(CartItemService);
    validateSpy = jest.spyOn(classValidator, 'validate');
    validateSpy.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('transformCartItemData', () => {
    it('should trow validation error when mismatched value is return from db', async () => {
      const mockPrismaCartItem = {
        quantity: 2,
        book: {
          id: 'book-id-no-uuid',
          title: 'Test Book Title',
          description: 'Test Description',
          isbn: '1234567890',
          price: 25.5,
          rating: 4.0,
          imageUrl: 'http://example.com/image.jpg',
          author: { name: 'Test Author' },
          category: { id: 5, name: 'Fiction' },
        },
      };

      jest.spyOn(classValidator, 'validate').mockResolvedValueOnce([
        {
          property: 'book.id',
          constraints: { isUuid: 'id must be a UUID' },
        },
      ] as any);

      await expect(
        service['transformCartItemData'](mockPrismaCartItem),
      ).rejects.toThrow('Validation failed.');

      validateSpy.mockRestore();
    });
    it('should correctly transform cart item data', async () => {
      const mockPrismaCartItem = {
        quantity: 2,
        book: {
          id: mockBookId3,
          title: 'Test Book Title',
          description: 'Test Description',
          isbn: '1234567890',
          price: 25.5,
          rating: 4.0,
          imageUrl: 'http://example.com/image.jpg',
          author: { name: 'Test Author' },
          category: { id: 5, name: 'Fiction' },
        },
      };

      const transformedData =
        await service['transformCartItemData'](mockPrismaCartItem);

      expect(transformedData).toEqual({
        quantity: 2,
        item: {
          id: mockBookId3,
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

  describe('deleteItem', () => {
    it('should throw an error if a database error occurs when the user tries to remove a product from the cart', async () => {
      const data = {
        bookId: mockBookId,
      };
      mockPrismaService.cartItem.delete.mockRejectedValueOnce('DB error.');

      try {
        await service.deleteItem(mockCartId, data);
      } catch (error) {
        expect(error.message).toBe(
          'Failed to delete item. Check cart and book IDs.',
        );
      }
    });

    it('should remove an item from the cart', async () => {
      const data = { bookId: mockBookId };

      mockPrismaService.cartItem.delete.mockResolvedValueOnce({});

      const result = await service.deleteItem(mockCartId, data);

      expect(result).toEqual({
        message: 'Item successfully deleted.',
      });
    });
  });

  describe('createOrUpdateItem', () => {
    it('it should throw an error if the book with the specified id does not exist', async () => {
      mockPrismaService.book.findUnique.mockReturnValueOnce(null);

      const data = {
        bookId: mockBookId,
        quantity: 1,
      };

      try {
        await service.createOrUpdateItem(mockCartId, data);
      } catch (error) {
        expect(error.message).toBe(`Book ID #${mockBookId} does not exist.`);
      }
    });

    it('it should throw an error if the stock of the book with the specified id is not sufficient', async () => {
      const data = {
        bookId: mockBookId,
        quantity: 10,
      };
      mockPrismaService.book.findUnique.mockReturnValueOnce({
        id: 1,
        stockQuantity: 1,
      });

      try {
        await service.createOrUpdateItem(mockCartId, data);
      } catch (error) {
        expect(error.message).toBe(
          `Insufficient stock for book ID: ${mockBookId}`,
        );
      }
    });

    it('should throw an error if the user tries to upser an item to a cart that belongs to someone else', async () => {
      mockPrismaService.book.findUnique.mockReturnValueOnce({
        id: 1,
        stockQuantity: 10,
      });
      mockPrismaService.cartItem.upsert.mockRejectedValueOnce(
        'This is not your cart.',
      );

      const data = {
        bookId: mockBookId,
        quantity: 1,
      };

      try {
        await service.createOrUpdateItem(mockCartId, data);
      } catch (error) {
        expect(error.message).toBe('Failed to update item. Check input data.');
      }
    });
    it('should upsert an item in the cart (create or update)', async () => {
      mockPrismaService.book.findUnique.mockResolvedValueOnce({
        id: 1,
        stockQuantity: 10,
      });

      mockPrismaService.cartItem.upsert.mockResolvedValueOnce({
        quantity: 5,
        book: {
          id: mockBookId,
          title: 'Test Book',
          description: 'test book description',
          isbn: 'book-isbn',
          price: 10.99,
          rating: 3.5,
          imageUrl: 'book-image-url',
          author: { name: 'test author' },
          category: { id: 1, name: 'test category' },
        },
      });

      const result = await service.createOrUpdateItem(mockCartId, {
        bookId: mockBookId,
        quantity: 5,
      });

      expect(result).toEqual({
        quantity: 5,
        item: {
          id: mockBookId,
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
      mockPrismaService.book.findUnique.mockResolvedValueOnce({
        id: 1,
        stockQuantity: 10,
      });
      mockPrismaService.cartItem.upsert.mockRejectedValueOnce(
        new Error('Unexpected database error'),
      );

      const data = {
        bookId: mockBookId,
        quantity: 1,
      };

      await expect(
        service.createOrUpdateItem(mockCartId, data),
      ).rejects.toThrow('Failed to update item. Check input data.');
    });
  });

  describe('getItems', () => {
    it('should return cart items for given cart', async () => {
      mockPrismaService.cartItem.findMany.mockResolvedValueOnce([
        {
          quantity: 3,
          book: {
            id: mockBookId,
            title: 'Test Book',
            description: 'test book description',
            isbn: 'book-isbn',
            price: 10.99,
            rating: 3.5,
            imageUrl: 'book-image-url',
            author: { name: 'test author' },
            category: { id: 1, name: 'test category' },
          },
        },
      ]);

      const result = await service.getItems(mockCartId);

      expect(result).toEqual([
        {
          quantity: 3,
          item: {
            id: mockBookId,
            title: 'Test Book',
            description: 'test book description',
            isbn: 'book-isbn',
            price: 10.99,
            rating: 3.5,
            imageUrl: 'book-image-url',
            author: { name: 'test author' },
            category: { id: 1, value: 'test category' },
          },
        },
      ]);
    });
  });

  describe('deleteItem', () => {
    it('should remove an item from the cart', async () => {
      mockPrismaService.cartItem.deleteMany.mockResolvedValueOnce({
        count: 2,
      });

      const result = await service.deleteItems(mockCartId);

      expect(result).toEqual({
        count: 2,
      });
      expect(mockPrismaService.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: mockCartId },
      });
    });
  });
});
