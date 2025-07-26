import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartGuard } from './guards/cart.guard';
import { CheckoutService } from './checkout/checkout.service';
import { CartItemService } from './cart-item.service';
import { CartCheckoutAction } from 'src/common/enum/cart-checkout-action.enum';
import { RoleEnum } from 'src/common/enum/role.enum';
import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { CustomAPIError } from 'src/common/errors/custom-api.error';
import { CreateCheckoutDTO } from 'src/common/dto/create-checkout.dto';
import { CheckoutRequestDTO } from 'src/common/dto/checkout-request.dto';
import { AddToCartDTO } from 'src/common/dto/add-to-cart.dto';

const mockCartService = {
  createCart: jest.fn(),
  findCart: jest.fn(),
  deleteCart: jest.fn(),
  updateCart: jest.fn(),
  mergeCarts: jest.fn(),
  removeInactiveGuestCarts: jest.fn(),
};
const mockCartItemService = {
  createOrUpdateItem: jest.fn(),
  deleteItem: jest.fn(),
};
const mockCheckoutService = {
  checkout: jest.fn(),
};

describe('CartController', () => {
  let controller: CartController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: CartService, useValue: mockCartService },
        { provide: CheckoutService, useValue: mockCheckoutService },
        { provide: CartItemService, useValue: mockCartItemService },
      ],
    })
      .overrideGuard(CartGuard)
      .useValue({ handleRequest: jest.fn() })
      .compile();

    controller = module.get<CartController>(CartController);
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('createCart', () => {
    it('should create guest cart when role=GuestUser', async () => {
      const expectedData = {
        cart: { id: 'cart-uuid-1', owner: null, items: [], totalPrice: 0 },
        guestCartToken: 'gc-token',
      };
      const req = { user: { id: null, role: RoleEnum.GuestUser } } as any;
      mockCartService.createCart.mockResolvedValueOnce(expectedData);

      const result = await controller.createCart(req);

      expect(result).toEqual(expectedData);
      expect(mockCartService.createCart).toHaveBeenCalledWith(null);
    });

    it('should create user cart when role=User and no existing cartId', async () => {
      const expectedData = {
        cart: {
          id: 'cart-uuid-2',
          owner: 'user-uuid-1',
          items: [],
          totalPrice: 0,
        },
        guestCartToken: null,
      };
      const req = { user: { role: RoleEnum.User, id: 'user-uuid-1' } } as any;
      mockCartService.createCart.mockResolvedValueOnce(expectedData);

      const result = await controller.createCart(req);

      expect(result).toEqual(expectedData);
      expect(mockCartService.createCart).toHaveBeenCalledWith('user-uuid-1');
    });

    it('should throw BadRequestException when user already has a cart', async () => {
      const req = {
        user: { id: 'user-uuid-1', role: RoleEnum.User, cartId: 'cart-uuid-1' },
      } as any;

      try {
        await controller.createCart(req);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('You already have a cart.');
      }
    });

    it('should throw InternalServerErrorException when unexpected error occurs', async () => {
      const req = { user: { role: RoleEnum.User, id: 'user-uuid-1' } } as any;
      mockCartService.createCart.mockRejectedValueOnce(new Error('Error'));

      try {
        await controller.createCart(req);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to create the cart due to an unexpected error.',
        );
      }
    });
  });

  describe('retrieveCart', () => {
    it('should return null when user has no cartId', async () => {
      const req = { user: { role: RoleEnum.User } } as any;
      const result = await controller.retrieveCart(req);

      expect(result).toEqual({ data: null });
    });

    it('should return cart when user has cartId', async () => {
      const cart = {
        id: 'cart-uuid-1',
        owner: 'user-uuid-1',
        items: [],
        totalPrice: 0,
      };
      const req = {
        user: { id: 'user-uuid-1', role: RoleEnum.User, cartId: 'cart-uuid-1' },
      } as any;

      mockCartService.findCart.mockResolvedValueOnce(cart);

      const result = await controller.retrieveCart(req);
      expect(result).toEqual({ data: cart });
      expect(mockCartService.findCart).toHaveBeenCalledWith('cart-uuid-1', {
        userId: 'user-uuid-1',
      });
    });

    it('should throw InternalServerErrorException when unexpected error occurs', async () => {
      const req = {
        user: { id: 'user-uuid-1', role: RoleEnum.User, cartId: 'cart-uuid-1' },
      } as any;

      mockCartService.findCart.mockRejectedValueOnce(new Error('Error'));

      try {
        await controller.retrieveCart(req);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to retrieve the cart due to an unexpected error.',
        );
      }
    });
  });

  describe('checkout', () => {
    const userCheckout = {
      url: 'https://checkout.stripe.com/pay/cs_test_a1b2c3d4e5f6g7h8i9j0',
      expiresAt: 1710000000,
      message: 'Checkout session created successfully.',
      order: {
        id: 'order-uuid-1',
        owner: {
          id: 'user-uuid-1',
          name: 'test user',
          email: 'testuser@email.com',
        },
        items: [
          {
            quantity: 2,
            item: {
              id: 'book-uuid-1',
              title: 'Book Title',
              description: 'Book description',
              isbn: '978-0451526342',
              author: {
                name: 'Test Author',
              },
              category: {
                id: 1,
                value: 'Travel',
              },
              price: 50.0,
              rating: 4.5,
              imageUrl: 'https://example.com/images/book-1.png',
            },
          },
        ],
        status: 'pending',
        price: 100.0,
      },
    };

    const guestCheckout = {
      url: 'https://checkout.stripe.com/pay/cs_test_a1b2c3d4e5f6g7h8i9j0',
      expiresAt: 1710000000,
      message: 'Checkout session created successfully.',
      order: {
        id: 'order-uuid-1',
        owner: null,
        items: [
          {
            quantity: 2,
            item: {
              id: 'book-uuid-1',
              title: 'Book Title',
              description: 'Book description',
              isbn: '978-0451526342',
              author: {
                name: 'Test Author',
              },
              category: {
                id: 1,
                value: 'Travel',
              },
              price: 50.0,
              rating: 4.5,
              imageUrl: 'https://example.com/images/book-1.png',
            },
          },
        ],
        status: 'pending',
        price: 100.0,
      },
    };
    it('should checkout successfully for authorized user', async () => {
      const payload: CreateCheckoutDTO = { cartId: 'cart-uuid-1' };
      const req = {
        user: { id: 'user-uuid-1', role: RoleEnum.User, cartId: 'cart-uuid-1' },
      } as any;

      mockCheckoutService.checkout.mockResolvedValueOnce(userCheckout);

      const result = await controller.checkout(req, payload);

      expect(result).toEqual({ data: userCheckout });
      expect(mockCheckoutService.checkout).toHaveBeenCalledWith(
        'user-uuid-1',
        payload,
      );
    });

    it('should allow guest checkout when token is present', async () => {
      const req = {
        user: {
          id: null,
          role: RoleEnum.GuestUser,
          guestCartToken: 'gc-token',
        },
      } as any;
      const payload: CreateCheckoutDTO = { cartId: 'cart-uuid-1' };
      mockCheckoutService.checkout.mockResolvedValueOnce(guestCheckout);

      const result = await controller.checkout(req, payload);

      expect(result).toEqual({ data: guestCheckout });
    });

    it('should throw UnauthorizedException when cartId mismatches for user', async () => {
      const req = {
        user: { id: 'user-uuid-1', role: RoleEnum.User, cartId: 'cart-uuid-1' },
      } as any;
      const payload = { cartId: 'cart-uuid-2' };

      try {
        await controller.checkout(req, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Unable to access this cart.');
      }
    });

    it('should convert CustomAPIError to BadRequestException', async () => {
      const payload = { cartId: 'cart-uuid-1' };
      const req = {
        user: { id: 'user-uuid-1', role: RoleEnum.User, cartId: 'cart-uuid-1' },
      } as any;

      mockCheckoutService.checkout.mockRejectedValueOnce(
        new CustomAPIError('Not enough stock for book ID: book-uuid-1'),
      );

      try {
        await controller.checkout(req, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Not enough stock for book ID: book-uuid-1');
      }
    });

    it('should throw InternalServerErrorException when unexpected error occurs', async () => {
      const payload = { cartId: 'cart-uuid-1' };
      const req = {
        user: { id: 'user-uuid-1', role: RoleEnum.User, cartId: 'cart-uuid-1' },
      } as any;

      mockCheckoutService.checkout.mockRejectedValueOnce(new Error('Error'));

      try {
        await controller.checkout(req, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to checkout due to an unexpected error.',
        );
      }
    });
  });

  describe('viewCart', () => {
    const cart = {
      id: 'cart-uuid-1',
      owner: 'user-uuid-1',
      items: [],
      totalPrice: 0,
    };

    it('should let admin view any cart', async () => {
      const req = { user: { id: 'admin-uuid-1', role: RoleEnum.Admin } } as any;

      mockCartService.findCart.mockResolvedValueOnce(cart);

      const result = await controller.viewCart('cart-uuid-1', req);

      expect(result).toEqual({ data: cart });
      expect(mockCartService.findCart).toHaveBeenCalledWith('cart-uuid-1');
    });

    it('should forbid user from viewing others cart', async () => {
      const req = {
        user: { id: 'user-uuid-1', role: RoleEnum.User, cartId: 'cart-uuid-2' },
      } as any;

      try {
        await controller.viewCart('cart-uuid-1', req);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Unable to access this cart.');
      }
    });

    it('should throw InternalServerErrorException when unexpected error occurs', async () => {
      const req = { user: { id: 'admin-uuid-1', role: RoleEnum.Admin } } as any;

      mockCartService.findCart.mockRejectedValueOnce(new Error('Error'));

      try {
        await controller.viewCart('cart-uuid-1', req);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to fetch the cart due to an unexpected error.',
        );
      }
    });
  });

  describe('cartSynchronize', () => {
    const guestCartId = 'gc-uuid-1';
    const userId = 'user-uuid-1';

    const guestCart = {
      id: guestCartId,
      owner: null,
      items: [],
      totalPrice: 0,
    };

    it('should deny malformed guest token', async () => {
      const req = {
        user: { id: userId, role: RoleEnum.User, cartId: 'cart-uuid-1' },
      } as any;
      const payload: CheckoutRequestDTO = {
        guestCartId,
        guestCartToken: ' bad ',
        action: CartCheckoutAction.MERGE,
      };

      try {
        await controller.cartSynchronize(req, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe(
          'Invalid or malformed guest cart token (contains leading/trailing spaces).',
        );
      }
    });

    it('should deny missing guest cart', async () => {
      const req = {
        user: { id: userId, role: RoleEnum.User, cartId: 'cart-uuid-1' },
      } as any;
      const payload: CheckoutRequestDTO = {
        guestCartId,
        guestCartToken: 'gc-token-1',
        action: CartCheckoutAction.KEEP_USER,
      };

      mockCartService.findCart.mockResolvedValueOnce(null);

      try {
        await controller.cartSynchronize(req, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe(
          'Guest cart not found or invalid guest cart credentials.',
        );
      }
    });

    it('should KEEP_GUEST and delete old user cart', async () => {
      const newCart = {
        id: guestCartId,
        owner: userId,
        items: [],
        totalPrice: 0,
      };

      const req = {
        user: { id: userId, role: RoleEnum.User, cartId: 'oldCart' },
      } as any;
      const payload: CheckoutRequestDTO = {
        guestCartId,
        guestCartToken: 'gc-token-1',
        action: CartCheckoutAction.KEEP_GUEST,
      };

      mockCartService.findCart.mockResolvedValueOnce(guestCart);
      mockCartService.deleteCart.mockResolvedValueOnce(undefined);
      mockCartService.updateCart.mockResolvedValueOnce(newCart);

      const result = await controller.cartSynchronize(req, payload);
      expect(result).toEqual({ data: newCart });
      expect(mockCartService.deleteCart).toHaveBeenCalledWith('oldCart');
      expect(mockCartService.updateCart).toHaveBeenCalledWith(
        guestCartId,
        userId,
        null,
      );
    });

    it('should KEEP_GUEST when no existing user cart', async () => {
      const newCart = {
        id: guestCartId,
        owner: userId,
        items: [],
        totalPrice: 0,
      };

      const req = { user: { id: userId, role: RoleEnum.User } } as any;
      const payload: CheckoutRequestDTO = {
        guestCartId,
        guestCartToken: 'gc-token-1',
        action: CartCheckoutAction.KEEP_GUEST,
      };

      mockCartService.findCart.mockResolvedValueOnce(guestCart);
      mockCartService.updateCart.mockResolvedValueOnce(newCart);

      const result = await controller.cartSynchronize(req, payload);
      expect(result).toEqual({ data: newCart });
      expect(mockCartService.deleteCart).not.toHaveBeenCalled();
      expect(mockCartService.updateCart).toHaveBeenCalledWith(
        guestCartId,
        userId,
        null,
      );
    });

    it('should KEEP_USER with existing user cart', async () => {
      const existing = {
        id: 'cart-uuid-1',
        owner: userId,
        items: [],
        totalPrice: 0,
      };

      const req = {
        user: { id: userId, role: RoleEnum.User, cartId: 'cart-uuid-1' },
      } as any;

      const payload: CheckoutRequestDTO = {
        guestCartId,
        guestCartToken: 'gc-token-1',
        action: CartCheckoutAction.KEEP_USER,
      };

      mockCartService.findCart
        .mockResolvedValueOnce(guestCart)
        .mockResolvedValueOnce(existing);

      const result = await controller.cartSynchronize(req, payload);

      expect(result).toEqual({ data: existing });
      expect(mockCartService.createCart).not.toHaveBeenCalled();
      expect(mockCartService.findCart).toHaveBeenCalledWith('cart-uuid-1', {
        userId,
      });
    });

    it('should KEEP_USER and create new cart if none exists', async () => {
      const req = { user: { id: userId, role: RoleEnum.User } } as any;
      const payload: CheckoutRequestDTO = {
        guestCartId,
        guestCartToken: 'gc-token-1',
        action: CartCheckoutAction.KEEP_USER,
      };

      const newEmpty = {
        cart: { id: 'cart-uuid-1', owner: userId, items: [], totalPrice: 0 },
        guestCartToken: null,
      };

      mockCartService.findCart.mockResolvedValueOnce(guestCart);
      mockCartService.createCart.mockResolvedValueOnce(newEmpty);

      const result = await controller.cartSynchronize(req, payload);
      expect(result).toEqual({ data: newEmpty.cart });
      expect(mockCartService.createCart).toHaveBeenCalledWith(userId);
    });

    // here 1

    it('should MERGE with existing user cart', async () => {
      const userCartId = 'cart-uuid-1';
      const mergedCart = {
        id: userCartId,
        owner: userId,
        items: [],
        totalPrice: 0,
      };

      const req = {
        user: { id: userId, role: RoleEnum.User, cartId: userCartId },
      } as any;

      const payload: CheckoutRequestDTO = {
        guestCartId,
        guestCartToken: 'gc-token-1',
        action: CartCheckoutAction.MERGE,
      };

      mockCartService.findCart.mockResolvedValueOnce(guestCart);
      mockCartService.mergeCarts.mockResolvedValueOnce(mergedCart);

      const result = await controller.cartSynchronize(req, payload);

      expect(result).toEqual({ data: mergedCart });
      expect(mockCartService.updateCart).not.toHaveBeenCalled();
      expect(mockCartService.mergeCarts).toHaveBeenCalledWith(
        guestCartId,
        userCartId,
      );
    });

    it('should MERGE and update guest when no user cart', async () => {
      const req: any = { user: { id: userId, role: RoleEnum.User } };
      const payload: CheckoutRequestDTO = {
        guestCartId,
        guestCartToken: 'gc-token-1',
        action: CartCheckoutAction.MERGE,
      };

      const updatedCart = { ...guestCart, owner: 'user-uuid-1' };

      mockCartService.findCart.mockResolvedValueOnce(guestCart);
      mockCartService.updateCart.mockResolvedValueOnce(updatedCart);

      const result = await controller.cartSynchronize(req, payload);
      expect(result).toEqual({ data: updatedCart });
      expect(mockCartService.updateCart).toHaveBeenCalledWith(
        guestCartId,
        userId,
        null,
      );
    });

    it('should throw BadRequestException on invalid action', async () => {
      const req: any = { user: { id: userId, role: RoleEnum.User } };
      const payload = {
        guestCartId,
        guestCartToken: 'gc-token-1',
        action: 'invalid action' as CartCheckoutAction,
      };

      mockCartService.findCart.mockResolvedValueOnce(guestCart);

      try {
        await controller.cartSynchronize(req, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          'Invalid cart synchronization action specified.',
        );
      }
    });

    it('should convert CustomAPIError to BadRequestException', async () => {
      const req: any = { user: { id: userId, role: RoleEnum.User } };
      const payload: CheckoutRequestDTO = {
        guestCartId,
        guestCartToken: 'gc-token-1',
        action: CartCheckoutAction.KEEP_GUEST,
      };

      mockCartService.findCart.mockResolvedValueOnce(guestCart);
      mockCartService.updateCart.mockRejectedValueOnce(
        new CustomAPIError('Either userID or guestToken must be provided.'),
      );

      try {
        await controller.cartSynchronize(req, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          'Either userID or guestToken must be provided.',
        );
      }
    });

    it('should throw InternalServerErrorException when unexpected error occurs', async () => {
      const req: any = { user: { id: userId, role: RoleEnum.User } };
      const payload: CheckoutRequestDTO = {
        guestCartId,
        guestCartToken: 'gc-token-1',
        action: CartCheckoutAction.KEEP_GUEST,
      };

      mockCartService.findCart.mockResolvedValueOnce({ id: guestCartId });
      mockCartService.updateCart.mockRejectedValueOnce(new Error('Error'));

      try {
        await controller.cartSynchronize(req, payload);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to synchronize the cart due to an unexpected error.',
        );
      }
    });
  });

  describe('addToCart', () => {
    const payload: AddToCartDTO = { bookId: 'book-uuid-1', quantity: 2 } as any;

    it('should add item when authorized user', async () => {
      const item = { quantity: 2 } as any;
      const req: any = { user: { role: RoleEnum.User, cartId: 'cart-uuid-1' } };

      mockCartItemService.createOrUpdateItem.mockResolvedValueOnce(item);

      const result = await controller.addToCart(req, 'cart-uuid-1', payload);

      expect(result).toEqual({ data: item });
      expect(mockCartItemService.createOrUpdateItem).toHaveBeenCalledWith(
        'cart-uuid-1',
        payload,
      );
    });

    it('should forbid unauthorized user', async () => {
      const req: any = { user: { role: RoleEnum.User, cartId: 'cart-uuid-1' } };
      try {
        await controller.addToCart(req, 'cart-uuid-2', payload);
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Unable to access this cart.');
      }
    });

    it('should throw InternalServerErrorException when unexpected error occurs', async () => {
      const req: any = { user: { role: RoleEnum.User, cartId: 'cart-uuid-1' } };
      mockCartItemService.createOrUpdateItem.mockRejectedValueOnce(
        new Error('Error'),
      );
      try {
        await controller.addToCart(req, 'cart-uuid-1', payload);
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to add the item to the cart due to an unexpected error.',
        );
      }
    });
  });

  describe('removeItem', () => {
    it('should remove item when authorized', async () => {
      const req: any = { user: { role: RoleEnum.User, cartId: 'cart-uuid-1' } };

      mockCartItemService.deleteItem.mockResolvedValueOnce({
        message: 'Item successfully deleted.',
      });

      const result = await controller.removeItem(
        req,
        'cart-uuid-1',
        'book-uuid-1',
      );
      expect(result).toEqual({ message: 'Item successfully deleted.' });
      expect(mockCartItemService.deleteItem).toHaveBeenCalledWith(
        'cart-uuid-1',
        { bookId: 'book-uuid-1' },
      );
    });

    it('should forbid unauthorized user', async () => {
      const req: any = { user: { role: RoleEnum.User, cartId: 'cart-uuid-1' } };

      try {
        await controller.removeItem(req, 'cart-uuid-2', 'book-uuid-1');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Unable to access this cart.');
      }
    });

    it('should throw InternalServerErrorException when unexpected error occurs', async () => {
      const req: any = { user: { role: RoleEnum.User, cartId: 'cart-uuid-1' } };
      mockCartItemService.deleteItem.mockRejectedValueOnce(new Error('Error'));

      try {
        await controller.removeItem(req, 'cart-uuid-1', 'book-uuid-1');
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to delete the cart due to an unexpected error.',
        );
      }
    });
  });

  describe('removeInactiveGuestCarts', () => {
    it('should remove inactive guest carts', async () => {
      mockCartService.removeInactiveGuestCarts.mockResolvedValueOnce({
        removed: 3,
      });
      const result = await controller.removeInactiveGuestCarts();
      expect(result).toEqual({ removed: 3 });
    });

    it('should throw InternalServerErrorException when error occurs', async () => {
      mockCartService.removeInactiveGuestCarts.mockRejectedValueOnce(
        new Error('Error'),
      );

      try {
        await controller.removeInactiveGuestCarts();
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect(error.message).toBe(
          'Failed to remove inactive guest carts due to an unexpected error.',
        );
      }
    });
  });

  describe('canUserAccessCart', () => {
    it('should grant access for Admin role', async () => {
      const result = await (controller as any).canUserAccessCart(
        { role: RoleEnum.Admin },
        'any-id',
      );
      expect(result).toEqual({ access: true, message: null });
    });

    it('should deny User without cartId', async () => {
      const result = await (controller as any).canUserAccessCart(
        { role: RoleEnum.User },
        'cart-1',
      );
      expect(result).toEqual({
        access: false,
        message: 'Please create a cart first.',
      });
    });

    it('should deny User with mismatched cartId', async () => {
      const user = { role: RoleEnum.User, cartId: 'cart-A' };
      const result = await (controller as any).canUserAccessCart(
        user,
        'cart-B',
      );
      expect(result).toEqual({
        access: false,
        message: 'Unable to access this cart.',
      });
    });

    it('should allow User with matching cartId', async () => {
      const user = { role: RoleEnum.User, cartId: 'same-id' };
      const result = await (controller as any).canUserAccessCart(
        user,
        'same-id',
      );
      expect(result).toEqual({ access: true, message: null });
    });

    it('should deny GuestUser missing guestCartToken', async () => {
      const user = { role: RoleEnum.GuestUser };
      const result = await (controller as any).canUserAccessCart(
        user,
        'cart-x',
      );
      expect(result).toEqual({
        access: false,
        message: 'Guest token missing from request.',
      });
    });

    it('allows GuestUser with guestCartToken', async () => {
      const user = { role: RoleEnum.GuestUser, guestCartToken: 'token' };
      const result = await (controller as any).canUserAccessCart(
        user,
        'cart-x',
      );
      expect(result).toEqual({ access: true, message: null });
    });

    it('should deny unknown role', async () => {
      const user = { role: 'SuperHero' as any };
      const result = await (controller as any).canUserAccessCart(user, 'any');
      expect(result).toEqual({
        access: false,
        message: 'Invalid user role.',
      });
    });
  });
});
