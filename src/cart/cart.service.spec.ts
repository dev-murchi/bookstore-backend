import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartItemService } from './cart-item.service';
import { HelperService } from '../common/helper.service';
import { CategoryDTO } from '../common/dto/category.dto';
import { BookDTO } from '../common/dto/book.dto';
import { CartItemDTO } from '../common/dto/cart-item.dto';
import * as classValidator from 'class-validator';
import { CustomAPIError } from '../common/errors/custom-api.error';

const mockCartId = 'abcdef01-2345-6789-abcd-ef0123456789'; // just example
const emptySpacedMockCartId = '  abcdef01-2345-6789-abcd-ef0123456789'; // just example

const mockBookId = 'ba22e8c2-8d5f-4ae2-835d-12f488667aed'; // just example

const mockUserId = '5610eb78-6602-4408-88f6-c2889cd136b7'; // just example
// const mockUserId2 = '5610eb78-1234-4408-88f6-c2889cd136b7'; // just example

const mockPrismaService = {
  cart: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest
    .fn()
    .mockImplementation((callback) => callback(mockPrismaService)),
};

const mockCartItemService = {
  getItems: jest.fn(),
  deleteItems: jest.fn(),
  createOrUpdateItem: jest.fn(),
};

const cartSelect = {
  id: true,
  userid: true,
  guest_cart_token: true,
};

describe('CartService', () => {
  let service: CartService;
  let validateSpy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CartItemService, useValue: mockCartItemService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);

    validateSpy = jest.spyOn(classValidator, 'validate');
    validateSpy.mockResolvedValue([]);

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
    it('should create a gues cart when userId is null', async () => {
      jest
        .spyOn(HelperService, 'generateToken')
        .mockReturnValueOnce('cartToken');

      jest
        .spyOn(HelperService, 'hashToken')
        .mockReturnValueOnce('cartTokenHash');

      mockCartItemService.getItems.mockResolvedValueOnce([]);
      mockPrismaService.cart.create.mockReturnValueOnce({
        id: mockCartId,
        userid: null,
        guest_cart_token: 'cartTokenHash',
      });

      const result = await service.createCart(null);
      expect(result).toEqual({
        cart: {
          id: mockCartId,
          owner: null,
          items: [],
          totalPrice: 0,
        },
        guestCartToken: 'cartToken',
      });
      expect(mockPrismaService.cart.create).toHaveBeenCalledWith({
        data: { userid: null, guest_cart_token: 'cartTokenHash' },
        select: cartSelect,
      });
    });

    it('should find or create a cart for a user with userId is provided', async () => {
      mockCartItemService.getItems.mockResolvedValueOnce([]);
      mockPrismaService.cart.create.mockReturnValueOnce({
        id: mockCartId,
        userid: mockUserId,
        guest_cart_token: null,
      });

      const result = await service.createCart(mockUserId);
      expect(result).toEqual({
        cart: {
          id: mockCartId,
          owner: mockUserId,
          items: [],
          totalPrice: 0,
        },
        guestCartToken: null,
      });
      expect(mockPrismaService.cart.create).toHaveBeenCalledWith({
        data: { userid: mockUserId, guest_cart_token: null },
        select: cartSelect,
      });
    });

    it('should throw an error if cart creation fails', async () => {
      mockPrismaService.cart.create.mockRejectedValueOnce(
        new Error('Database error during create'),
      );

      await expect(service.createCart(mockUserId)).rejects.toThrow(
        'Cart creation failed.',
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

  describe('transformCartData', () => {
    it('should correctly transform cart data with multiple items', async () => {
      const book = new BookDTO(
        mockBookId,
        'Book One',
        'Desc 1',
        'isbn1',
        { name: 'Author A' },
        new CategoryDTO(1, 'Cat A'),
        20,
        3.5,
        'img1',
      );

      const cartItem = new CartItemDTO(1, book);

      mockCartItemService.getItems.mockResolvedValueOnce([cartItem]);
      const mockPrismaCart = {
        id: mockCartId,
        userid: mockUserId,
        guest_cart_token: null,
      };

      const transformedData =
        await service['transformCartData'](mockPrismaCart);

      expect(transformedData).toEqual({
        id: mockCartId,
        owner: mockUserId,
        totalPrice: 20.0,
        items: [
          {
            quantity: 1,
            item: {
              id: mockBookId,
              title: 'Book One',
              description: 'Desc 1',
              isbn: 'isbn1',
              price: 20.0,
              rating: 3.5,
              imageUrl: 'img1',
              author: { name: 'Author A' },
              category: { id: 1, value: 'Cat A' },
            },
          },
        ],
      });
    });

    it('should correctly transform cart data with empty items', async () => {
      const mockPrismaCart = {
        id: mockCartId,
        userid: mockUserId,
        guest_cart_token: null,
      };

      mockCartItemService.getItems.mockResolvedValueOnce([]);
      const transformedData =
        await service['transformCartData'](mockPrismaCart);

      expect(transformedData).toEqual({
        id: mockCartId,
        owner: mockUserId,
        totalPrice: 0,
        items: [],
      });
    });

    it('should trow validation error when mismatched value is return from db', async () => {
      const mockPrismaCart = {
        id: 1,
        userid: mockUserId,
        guest_cart_token: null,
      };
      mockCartItemService.getItems.mockResolvedValueOnce([]);
      jest.spyOn(classValidator, 'validate').mockResolvedValueOnce([
        {
          property: 'id',
          constraints: { isUuid: 'id must be a UUID' },
        },
      ] as any);

      await expect(
        service['transformCartData'](mockPrismaCart),
      ).rejects.toThrow('Validation failed.');

      validateSpy.mockRestore();
    });
  });

  describe('findCart', () => {
    it('should throw error if both userId and guestToken are provided', async () => {
      const guestToken = 'invalidToken';

      await expect(
        service.findCart(mockCartId, { userId: mockUserId, guestToken }),
      ).rejects.toThrow(
        new CustomAPIError(
          'User id and guest cart token cannot be provided at the same time',
        ),
      );
    });

    it('should throw error if provided userId has not same length after trim()', async () => {
      await expect(
        service.findCart(mockCartId, { userId: emptySpacedMockCartId }),
      ).rejects.toThrow(new CustomAPIError('Please provide valid user id'));
    });

    it('should throw error if provided guest cart token has not same length after trim()', async () => {
      await expect(
        service.findCart(mockCartId, { guestToken: ' emptySpace' }),
      ).rejects.toThrow(
        new CustomAPIError('Please provide valid guest cart token'),
      );
    });

    it('should throw error when unexpected db error occurs', async () => {
      mockPrismaService.cart.findUnique.mockRejectedValueOnce(
        new Error('DB Error'),
      );
      await expect(
        service.findCart(mockCartId, { userId: mockUserId }),
      ).rejects.toThrow(new Error('Failed to retrieve the cart.'));
    });

    it('should return null if no cart is found for the given cartId', async () => {
      mockPrismaService.cart.findUnique.mockReturnValueOnce(null);

      const result = await service.findCart(mockCartId);
      expect(result).toBeNull();
    });

    it('should return null if guestToken does not match cart token', async () => {
      const guestToken = 'invalidGuestToken';

      mockPrismaService.cart.findUnique.mockReturnValueOnce({
        id: mockCartId,
        userid: null,
        guest_cart_token: 'validTokenHash',
      });

      jest.spyOn(HelperService, 'verifyTokenHash').mockReturnValueOnce(false);

      const result = await service.findCart(mockCartId, { guestToken });

      expect(result).toBeNull();
    });

    it('should return cart data when valid userId is provided', async () => {
      mockPrismaService.cart.findUnique.mockReturnValueOnce({
        id: mockCartId,
        userid: mockUserId,
        guest_cart_token: null,
      });

      mockCartItemService.getItems.mockResolvedValueOnce([]);

      const result = await service.findCart(mockCartId, { userId: mockUserId });

      expect(result).toEqual({
        id: mockCartId,
        owner: mockUserId,
        totalPrice: 0,
        items: [],
      });
      expect(mockPrismaService.cart.findUnique).toHaveBeenCalledWith({
        where: { id: mockCartId, userid: mockUserId },
        select: cartSelect,
      });
    });

    it('should return cart data when valid guestToken is provided', async () => {
      const guestToken = 'validGuestToken';

      mockPrismaService.cart.findUnique.mockReturnValueOnce({
        id: mockCartId,
        userid: null,
        guest_cart_token: 'hashedToken',
      });

      mockCartItemService.getItems.mockResolvedValueOnce([]);

      jest.spyOn(HelperService, 'verifyTokenHash').mockReturnValueOnce(true);

      const result = await service.findCart(mockCartId, { guestToken });

      expect(result).toEqual({
        id: mockCartId,
        owner: null,
        totalPrice: 0,
        items: [],
      });
    });

    it('should return null if userId is provided but cart has a guest_cart_token', async () => {
      mockPrismaService.cart.findUnique.mockReturnValueOnce({
        id: mockCartId,
        userid: mockUserId,
        guest_cart_token: 'non-null-token',
      });

      const result = await service.findCart(mockCartId, { userId: mockUserId });

      expect(result).toBeNull();
    });

    it('should return null if both userid and guest_cart_token are null', async () => {
      mockPrismaService.cart.findUnique.mockReturnValueOnce({
        id: mockCartId,
        userid: null,
        guest_cart_token: null,
      });

      const result = await service.findCart(mockCartId, {
        guestToken: 'guest-token',
      });

      expect(result).toBeNull();
    });
  });

  describe('deleteCart', () => {
    it('should delete a cart successfully', async () => {
      mockPrismaService.cart.delete.mockResolvedValueOnce({});

      await service.deleteCart(mockCartId);

      expect(mockPrismaService.cart.delete).toHaveBeenCalledWith({
        where: { id: mockCartId },
      });
    });

    it('should throw an error if deleting cart fails', async () => {
      mockPrismaService.cart.delete.mockRejectedValueOnce(
        new Error('Failed to delete'),
      );

      await expect(service.deleteCart(mockCartId)).rejects.toThrow(
        'Failed to delete the Cart abcdef01-2345-6789-abcd-ef0123456789',
      );
    });
  });

  describe('validateUserAndGuestToken', () => {
    it('should return trimmed values when already valid', () => {
      const result = service['validateUserAndGuestToken']('user123', null);
      expect(result).toEqual({
        trimmedUserId: 'user123',
        trimmedGuestToken: null,
        hasUserId: true,
        hasGuestToken: false,
      });
    });

    it('should throw if both userId and guestToken are provided', () => {
      expect(() =>
        service['validateUserAndGuestToken']('user', 'guest'),
      ).toThrow(
        new CustomAPIError(
          'User id and guest cart token cannot be provided at the same time',
        ),
      );
    });

    it('should throw if userId trimming changes the value', () => {
      expect(() =>
        service['validateUserAndGuestToken'](' user ', null),
      ).toThrow(new CustomAPIError('Please provide valid user id'));
    });

    it('should throw if guestToken trimming changes the value', () => {
      expect(() =>
        service['validateUserAndGuestToken'](null, ' guest '),
      ).toThrow(new CustomAPIError('Please provide valid guest cart token'));
    });
  });

  describe('updateCart', () => {
    const baseCart = {
      id: mockCartId,
      userid: mockUserId,
      guest_cart_token: null,
    };

    it('should throw an error if neither userId nor guestToken is provided', async () => {
      await expect(service.updateCart(mockCartId, null, null)).rejects.toThrow(
        new CustomAPIError('Either userID or guestToken must be provided.'),
      );
    });

    it('should update cart with userId and clear guest token', async () => {
      const updatedCart = {
        ...baseCart,
        userid: mockUserId,
        guest_cart_token: null,
      };

      mockPrismaService.cart.update.mockResolvedValueOnce(updatedCart);
      mockCartItemService.getItems.mockResolvedValueOnce([]);

      const result = await service.updateCart(mockCartId, mockUserId, null);

      expect(mockPrismaService.cart.update).toHaveBeenCalledWith({
        where: { id: mockCartId },
        data: {
          user: { connect: { id: mockUserId } },
          guest_cart_token: null,
        },
        select: cartSelect,
      });

      expect(result).toEqual({
        id: mockCartId,
        owner: mockUserId,
        items: [],
        totalPrice: 0,
      });
    });

    it('should update cart with guestToken and disconnect user', async () => {
      const guestToken = 'abc123guest';
      const hashedToken = 'hashedGuestToken';

      jest.spyOn(HelperService, 'hashToken').mockReturnValueOnce(hashedToken);

      const updatedCart = {
        id: mockCartId,
        userid: null,
        guest_cart_token: hashedToken,
      };

      mockPrismaService.cart.update.mockResolvedValueOnce(updatedCart);
      mockCartItemService.getItems.mockResolvedValueOnce([]);

      const result = await service.updateCart(mockCartId, null, guestToken);

      expect(mockPrismaService.cart.update).toHaveBeenCalledWith({
        where: { id: mockCartId },
        data: {
          guest_cart_token: hashedToken,
          user: { disconnect: true },
        },
        select: cartSelect,
      });

      expect(result).toEqual({
        id: mockCartId,
        owner: null,
        items: [],
        totalPrice: 0,
      });
    });

    it('should throw error if update operation fails with unknown error', async () => {
      mockPrismaService.cart.update.mockRejectedValueOnce(
        new Error('Unexpected DB Error'),
      );

      await expect(
        service.updateCart(mockCartId, mockUserId, null),
      ).rejects.toThrow('Failed to update the cart.');
    });

    it('should rethrow a known CustomAPIError', async () => {
      const customError = new CustomAPIError('Specific validation failed.');
      mockPrismaService.cart.update.mockRejectedValueOnce(customError);

      await expect(
        service.updateCart(mockCartId, mockUserId, null),
      ).rejects.toThrow(customError);
    });
  });

  describe('mergeCarts', () => {
    const sourceCartId = 'source-cart-id';
    const destCartId = 'dest-cart-id';
    const category = new CategoryDTO(1, 'Cat A');
    const author = { name: 'Author A' };
    const description = 'descr';
    const price = 20;
    const rating = 3.5;

    const book1 = new BookDTO(
      'book1',
      'Book One',
      description,
      'isbn1',
      author,
      category,
      price,
      rating,
      'img1',
    );

    const book2 = new BookDTO(
      'book2',
      'Book Two',
      description,
      'isbn2',
      author,
      category,
      price,
      rating,
      'img2',
    );
    const book3 = new BookDTO(
      'book3',
      'Book Three',
      description,
      'isbn2',
      author,
      category,
      price,
      rating,
      'img3',
    );

    it('should merge items from source cart into destination cart', async () => {
      const sourceCartItems = [
        new CartItemDTO(2, book1),
        new CartItemDTO(1, book2),
      ];

      const destCartItems = [
        new CartItemDTO(3, book2),
        new CartItemDTO(1, book3),
      ];

      mockCartItemService.getItems
        .mockResolvedValueOnce(sourceCartItems)
        .mockResolvedValueOnce(destCartItems)
        .mockResolvedValueOnce([
          new CartItemDTO(4, book2),
          new CartItemDTO(1, book3),
          new CartItemDTO(2, book1),
        ]);

      mockCartItemService.createOrUpdateItem.mockResolvedValueOnce({});
      mockCartItemService.deleteItems.mockResolvedValueOnce({});
      mockPrismaService.cart.delete.mockResolvedValueOnce({});
      mockPrismaService.cart.findUnique.mockResolvedValueOnce({
        id: 'cart-id',
        userid: 'user-1',
        guest_cart_token: null,
      });

      const result = await service.mergeCarts(sourceCartId, destCartId);

      expect(result).toEqual({
        id: 'cart-id',
        owner: 'user-1',
        totalPrice: 140,
        items: [
          new CartItemDTO(4, book2),
          new CartItemDTO(1, book3),
          new CartItemDTO(2, book1),
        ],
      });

      expect(mockCartItemService.createOrUpdateItem).toHaveBeenCalledTimes(2);
      expect(mockCartItemService.createOrUpdateItem).toHaveBeenCalledWith(
        destCartId,
        expect.objectContaining({
          quantity: 4,
          bookId: 'book2',
        }),
      );
      expect(mockCartItemService.createOrUpdateItem).toHaveBeenCalledWith(
        destCartId,
        expect.objectContaining({
          quantity: 2,
          bookId: 'book1',
        }),
      );

      expect(mockCartItemService.deleteItems).toHaveBeenCalledWith(
        sourceCartId,
      );
      expect(mockPrismaService.cart.delete).toHaveBeenCalledWith({
        where: { id: sourceCartId },
      });
    });

    it('should not modify the destination cart if the source cart is empty', async () => {
      const sourceCartItems = [];
      const destCartItems = [
        new CartItemDTO(2, book1),
        new CartItemDTO(3, book2),
      ];

      mockCartItemService.getItems
        .mockResolvedValueOnce(sourceCartItems)
        .mockResolvedValueOnce(destCartItems)
        .mockResolvedValueOnce(destCartItems);

      mockCartItemService.createOrUpdateItem.mockResolvedValueOnce({});
      mockCartItemService.deleteItems.mockResolvedValueOnce({});
      mockPrismaService.cart.delete.mockResolvedValueOnce({});
      mockPrismaService.cart.findUnique.mockResolvedValueOnce({
        id: 'cart-id-2',
        userid: 'user-2',
        guest_cart_token: null,
      });

      const result = await service.mergeCarts(sourceCartId, destCartId);

      expect(result).toEqual({
        id: 'cart-id-2',
        owner: 'user-2',
        totalPrice: 100,
        items: [new CartItemDTO(2, book1), new CartItemDTO(3, book2)],
      });

      expect(mockCartItemService.createOrUpdateItem).not.toHaveBeenCalled();

      expect(mockCartItemService.deleteItems).toHaveBeenCalledWith(
        sourceCartId,
      );
      expect(mockPrismaService.cart.delete).toHaveBeenCalledWith({
        where: { id: sourceCartId },
      });
    });

    it('should handle merging when source and destination carts contain the same items', async () => {
      const sourceCartItems = [
        new CartItemDTO(2, book1),
        new CartItemDTO(1, book2),
      ];

      const destCartItems = [
        new CartItemDTO(1, book1),
        new CartItemDTO(2, book2),
      ];

      mockCartItemService.getItems
        .mockResolvedValueOnce(sourceCartItems)
        .mockResolvedValueOnce(destCartItems)
        .mockResolvedValueOnce([
          new CartItemDTO(3, book1),
          new CartItemDTO(3, book2),
        ]);

      mockCartItemService.createOrUpdateItem.mockResolvedValueOnce({});
      mockCartItemService.deleteItems.mockResolvedValueOnce({});
      mockPrismaService.cart.delete.mockResolvedValueOnce({});

      mockPrismaService.cart.findUnique.mockResolvedValueOnce({
        id: 'cart-id',
        userid: 'user-3',
        guest_cart_token: null,
      });

      const result = await service.mergeCarts(sourceCartId, destCartId);

      expect(result).toEqual({
        id: 'cart-id',
        owner: 'user-3',
        totalPrice: 120,
        items: [new CartItemDTO(3, book1), new CartItemDTO(3, book2)],
      });

      expect(mockCartItemService.createOrUpdateItem).toHaveBeenCalledWith(
        destCartId,
        expect.objectContaining({
          quantity: 3,
          bookId: 'book1',
        }),
      );
      expect(mockCartItemService.createOrUpdateItem).toHaveBeenCalledWith(
        destCartId,
        expect.objectContaining({
          quantity: 3,
          bookId: 'book2',
        }),
      );

      expect(mockCartItemService.deleteItems).toHaveBeenCalledWith(
        sourceCartId,
      );
      expect(mockPrismaService.cart.delete).toHaveBeenCalledWith({
        where: { id: sourceCartId },
      });
    });

    it('should throw an error if merging carts fails', async () => {
      const errorMessage = 'Database error during cart merge';
      const sourceCartItems = [
        new CartItemDTO(2, book1),
        new CartItemDTO(3, book3),
      ];

      const destCartItems = [new CartItemDTO(1, book2)];
      mockCartItemService.getItems.mockResolvedValueOnce(sourceCartItems);
      mockCartItemService.getItems.mockResolvedValueOnce(destCartItems);
      mockCartItemService.createOrUpdateItem.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      await expect(
        service.mergeCarts(sourceCartId, destCartId),
      ).rejects.toThrow(new Error('Failed to merge carts.'));
    });

    it('should throw an error if deleting source cart fails after merging', async () => {
      const sourceCartItems = [new CartItemDTO(2, book1)];
      const destCartItems = [new CartItemDTO(1, book2)];

      mockCartItemService.getItems
        .mockResolvedValueOnce(sourceCartItems)
        .mockResolvedValueOnce(destCartItems);

      mockCartItemService.createOrUpdateItem.mockResolvedValueOnce({});
      mockCartItemService.deleteItems.mockResolvedValueOnce({});
      mockPrismaService.cart.delete.mockRejectedValueOnce(
        new Error('Failed to delete source cart'),
      );

      await expect(
        service.mergeCarts(sourceCartId, destCartId),
      ).rejects.toThrow('Failed to merge carts.');

      expect(mockCartItemService.deleteItems).toHaveBeenCalledWith(
        sourceCartId,
      );
      expect(mockPrismaService.cart.delete).toHaveBeenCalledWith({
        where: { id: sourceCartId },
      });
    });
  });
});
