import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { CartDTO } from '../common/dto/cart.dto';
import { HelperService } from '../common/helper.service';
import { CartItemService } from './cart-item.service';
import { validate } from 'class-validator';
import { Prisma } from '@prisma/client';

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartItemService: CartItemService,
  ) {}

  private readonly cartSelect = {
    id: true,
    userid: true,
    guest_cart_token: true,
  };

  async createCart(userId: string | null) {
    try {
      let guestCartToken = null;
      let guestCartTokenHash = null;

      if (!userId) {
        userId = null;
        guestCartToken = HelperService.generateToken();
        guestCartTokenHash = HelperService.hashToken(
          guestCartToken,
          'base64url',
        );
      }

      const cart = await this.prisma.cart.create({
        data: { userid: userId, guest_cart_token: guestCartTokenHash },
        select: this.cartSelect,
      });

      return { cart: await this.transformCartData(cart), guestCartToken };
    } catch (error) {
      console.error('Error creating cart. Error:', error);
      throw new Error('Cart creation failed.');
    }
  }

  async removeInactiveGuestCarts(): Promise<{ removed: number }> {
    try {
      // remove the inactive carts
      // the cart is inactive if it was created less than 1 day ago.
      const currentDateTime = new Date().getTime();
      const expirationDate = new Date(currentDateTime - 24 * 60 * 60 * 1000);

      const result = await this.prisma.cart.deleteMany({
        where: { userid: null, created_at: { lt: expirationDate } },
      });

      return { removed: result.count };
    } catch (error) {
      console.error('Failed to remove inactive guest carts. Error:', error);
      throw new Error('Failed to remove inactive guest carts');
    }
  }

  private async transformCartData(cartData: any): Promise<CartDTO> {
    const cartItems = await this.cartItemService.getItems(cartData.id);
    const totalPrice = Number(
      cartItems
        .reduce((sum, item) => sum + item.item.price * item.quantity, 0)
        .toFixed(2),
    );

    const cart = new CartDTO(
      cartData.id,
      cartData.userid,
      totalPrice,
      cartItems,
    );

    const errors = await validate(cart);

    if (errors.length > 0) {
      console.error('Validation failed. Error:', errors);
      throw new Error('Validation failed.');
    }

    return cart;
  }

  async findCart(
    cartId: string,
    options?: {
      userId?: string | null;
      guestToken?: string | null;
    },
  ) {
    try {
      const { trimmedUserId, trimmedGuestToken, hasUserId, hasGuestToken } =
        this.validateUserAndGuestToken(options?.userId, options?.guestToken);

      const cart = await this.prisma.cart.findUnique({
        where: {
          id: cartId,
          userid: hasUserId ? trimmedUserId : null,
        },
        select: this.cartSelect,
      });

      if (!cart) return null;

      if (hasUserId) {
        if (cart.guest_cart_token) return null;
      } else if (hasGuestToken) {
        if (!cart.guest_cart_token) return null;

        const isValid = HelperService.verifyTokenHash(
          trimmedGuestToken,
          cart.guest_cart_token,
          'base64url',
        );

        if (!isValid) {
          return null;
        }
      }

      return await this.transformCartData(cart);
    } catch (error) {
      console.error('Failed to retrieve the cart. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new Error('Failed to retrieve the cart.');
    }
  }

  async deleteCart(cartId: string) {
    try {
      await this.prisma.cart.delete({ where: { id: cartId } });
    } catch (error) {
      console.error('Failed to delete the cart. Error:', error);
      throw new Error(`Failed to delete the Cart ${cartId}`);
    }
  }

  async mergeCarts(sourceCart: string, destCart: string) {
    try {
      await this.prisma.$transaction(async () => {
        const sourceCartItems = await this.cartItemService.getItems(sourceCart);
        const destCartItems = await this.cartItemService.getItems(destCart);

        const destCartItemsMap = new Map(
          destCartItems.map((item) => [item.item.id, item]),
        );

        const operations = [];

        for (const sourceItem of sourceCartItems) {
          const destItem = destCartItemsMap.get(sourceItem.item.id);
          let quantity = sourceItem.quantity;

          if (destItem) {
            quantity += destItem.quantity;
          }

          operations.push(
            this.cartItemService.createOrUpdateItem(destCart, {
              quantity: quantity,
              bookId: sourceItem.item.id,
            }),
          );
        }

        operations.push(this.cartItemService.deleteItems(sourceCart));
        operations.push(this.deleteCart(sourceCart));

        await Promise.all(operations);
      });
      return await this.findCart(destCart);
    } catch (error) {
      console.error('Error while merging carts:', error);
      throw new Error('Failed to merge carts.');
    }
  }

  async updateCart(
    cartId: string,
    userId: string | null,
    guestToken: string | null,
  ): Promise<CartDTO> {
    const { trimmedUserId, trimmedGuestToken, hasUserId, hasGuestToken } =
      this.validateUserAndGuestToken(userId, guestToken);

    if (!hasUserId && !hasGuestToken) {
      throw new CustomAPIError('Either userID or guestToken must be provided.');
    }
    const updateData: Prisma.cartUpdateInput = {};

    if (hasUserId) {
      updateData.user = { connect: { id: trimmedUserId! } };
      updateData.guest_cart_token = null;
    } else if (hasGuestToken) {
      updateData.guest_cart_token = HelperService.hashToken(
        trimmedGuestToken!,
        'base64url',
      );
      updateData.user = { disconnect: true };
    }

    try {
      const updatedCart = await this.prisma.cart.update({
        where: { id: cartId },
        data: updateData,
        select: this.cartSelect,
      });

      return await this.transformCartData(updatedCart);
    } catch (error) {
      console.error('Failed to update the cart. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new Error('Failed to update the cart.');
    }
  }

  private validateUserAndGuestToken(
    userId: string | null,
    guestToken: string | null,
  ) {
    const trimmedUserId = userId?.trim() || null;
    const trimmedGuestToken = guestToken?.trim() || null;

    const hasUserId = !!trimmedUserId;
    const hasGuestToken = !!trimmedGuestToken;

    if (hasUserId && hasGuestToken) {
      throw new CustomAPIError(
        'User id and guest cart token cannot be provided at the same time',
      );
    }

    if (hasUserId && trimmedUserId !== userId) {
      throw new CustomAPIError('Please provide valid user id');
    }
    if (hasGuestToken && trimmedGuestToken !== guestToken) {
      throw new CustomAPIError('Please provide valid guest cart token');
    }

    return { trimmedUserId, trimmedGuestToken, hasUserId, hasGuestToken };
  }
}
