import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartItemDto } from './dto/cart-item.dto';
import { DeleteCartItemDto } from './dto/delete-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}
  async createCart(userId: number | null) {
    // create a new cart for the guest user
    if (!userId) {
      const cart = await this.prisma.cart.create({
        data: {
          userid: userId,
        },
      });
      return { cartId: cart.id };
    }

    // find or create the cart for the user
    const cart = await this.prisma.cart.upsert({
      where: { userid: userId },
      update: {},
      create: {
        userid: userId,
      },
    });

    return { cartId: cart.id };
  }

  async findCart(cartId: number) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      select: {
        userid: true,
        cart_items: {
          select: {
            quantity: true,
            book: {
              select: {
                id: true,
                title: true,
                price: true,
              },
            },
          },
        },
      },
    });

    if (!cart) throw Error('Cart is not exist.');

    const cartItems = cart.cart_items.map((item) => ({
      bookId: item.book.id,
      bookTitle: item.book.title,
      price: parseFloat(item.book.price.toFixed(2)),
      quantity: item.quantity,
    }));

    const totalPrice = parseFloat(
      cartItems.reduce((p, c) => p + c.price * c.quantity, 0).toFixed(2),
    );

    return {
      cartId,
      userId: cart.userid,
      cartItems,
      totalPrice,
    };
  }

  async addItem(data: CartItemDto) {
    await this.prisma.cart_items.create({
      data: {
        cart: { connect: { id: data.cartId } },
        book: { connect: { id: data.bookId } },
        quantity: data.quantity,
      },
    });

    return {
      message: 'Item successfully added.',
    };
  }

  async updateItem(userId: number | null, data: CartItemDto) {
    try {
      // user can only update items from its own cart
      const item = await this.prisma.cart_items.update({
        where: {
          cartid_bookid: {
            bookid: data.bookId,
            cartid: data.cartId,
          },
          AND: [{ cart: { userid: userId } }],
        },
        data: { quantity: data.quantity },
      });

      return {
        message: 'Item successfully updated.',
      };
    } catch (error) {
      throw Error(
        'An error occurred while updating the item. Please check if the cart ID and book ID are correct, and ensure the quantity is valid',
      );
    }
  }

  async removeItem(userId: number | null, data: DeleteCartItemDto) {
    try {
      // user can only remove items from its own cart
      await this.prisma.cart_items.delete({
        where: {
          cartid_bookid: {
            cartid: data.cartId,
            bookid: data.bookId,
          },
          AND: [{ cart: { userid: userId } }],
        },
      });

      return {
        message: 'Item successfully deleted.',
      };
    } catch (error) {
      throw Error(
        'An error occurred while deleting the item. Please check if the cart ID and book ID are correct.',
      );
    }
  }

  async upsertItem(userId: number | null, data: CartItemDto) {
    try {
      // user can update/create items for its own cart
      await this.prisma.cart_items.upsert({
        where: {
          cartid_bookid: {
            cartid: data.cartId,
            bookid: data.bookId,
          },
          AND: [{ cart: { userid: userId } }],
        },
        update: { quantity: data.quantity },
        create: {
          cart: { connect: { id: data.cartId, AND: [{ userid: userId }] } },
          book: { connect: { id: data.bookId } },
          quantity: data.quantity,
        },
      });

      return {
        message: 'Item successfully updated.',
      };
    } catch (error) {
      throw Error(
        'An error occurred while updating the item. Please check if the cart ID and book ID are correct, and ensure the quantity is valid',
      );
    }
  }

  async claim(userId: number, cartId: number) {
    try {
      if (userId) {
        const oldCart = await this.prisma.cart.findUnique({
          where: { userid: userId },
          select: {
            cart_items: true,
          },
        });

        if (oldCart && oldCart.cart_items.length > 0) {
          throw new Error('User cart is not empty');
        }
      }
      // user can only claim the cart created by the guest
      await this.prisma.cart.update({
        where: { id: cartId, AND: [{ userid: null }] },
        data: { user: { connect: { id: userId } } },
      });

      return { message: 'User is attached to the cart.' };
    } catch (error) {
      if (error.message === 'User cart is not empty') {
        throw new Error(
          'Your cart is not empty. Please clear it before claiming the new cart.',
        );
      }
      throw new Error('User can only claim the cart created by the guest.');
    }
  }
}
