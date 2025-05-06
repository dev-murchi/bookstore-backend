import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartItemDto } from './dto/cart-item.dto';
import { DeleteCartItemDto } from './dto/delete-cart-item.dto';
import { CustomAPIError } from '../common/errors/custom-api.error';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}
  async createCart(userId: string | null) {
    try {
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
          user: { connect: { userid: userId } },
        },
      });

      return { cartId: cart.id };
    } catch (error) {
      console.error('Error:', error);
      throw new Error('Cart creation failed.');
    }
  }

  async findCart(cartId: number) {
    try {
      const cart = await this.prisma.cart.findUnique({
        where: { id: cartId },
        select: {
          userid: true,
          cart_items: {
            orderBy: { bookid: 'asc' },
            select: {
              quantity: true,
              book: {
                select: {
                  bookid: true,
                  title: true,
                  price: true,
                },
              },
            },
          },
        },
      });

      if (!cart) throw new CustomAPIError('Cart is not exist.');

      const cartItems = cart.cart_items.map((item) => ({
        bookId: item.book.bookid,
        bookTitle: item.book.title,
        price: Number(item.book.price.toFixed(2)),
        quantity: item.quantity,
      }));

      const totalPrice = Number(
        cartItems.reduce((p, c) => p + c.price * c.quantity, 0).toFixed(2),
      );

      return {
        cartId,
        userId: cart.userid,
        cartItems,
        totalPrice,
      };
    } catch (error) {
      console.error('Failed to fetch the cart. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new Error('Failed to fetch the cart.');
    }
  }

  async addItem(data: CartItemDto) {
    try {
      await this.prisma.cart_items.create({
        data: {
          cart: { connect: { id: data.cartId } },
          book: { connect: { bookid: data.bookId } },
          quantity: data.quantity,
        },
      });

      return {
        message: 'Item successfully added.',
      };
    } catch (error) {
      console.error('Failed to add the item. Error:', error);
      throw new Error('Failed to add the item.');
    }
  }

  async updateItem(userId: string | null, data: CartItemDto) {
    try {
      // check book stock
      const book = await this.prisma.books.findUnique({
        where: { bookid: data.bookId },
        select: {
          id: true,
          stock_quantity: true,
        },
      });

      if (!book)
        throw new CustomAPIError(`Book ID #${data.bookId} is not exist.`);

      if (book.stock_quantity < data.quantity) {
        throw new CustomAPIError(
          `Not enough stock for book ID: ${data.bookId}`,
        );
      }

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
      if (error instanceof CustomAPIError) throw error;
      throw Error(
        'An error occurred while updating the item. Please check if the cart ID and book ID are correct, and ensure the quantity is valid',
      );
    }
  }

  async removeItem(userId: string | null, data: DeleteCartItemDto) {
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
      console.error('Error occurred while deleting the item. Error:', error);
      throw Error(
        'An error occurred while deleting the item. Please check if the cart ID and book ID are correct.',
      );
    }
  }

  async upsertItem(userId: string | null, data: CartItemDto) {
    try {
      // check book stock
      const book = await this.prisma.books.findUnique({
        where: { bookid: data.bookId },
        select: {
          id: true,
          stock_quantity: true,
        },
      });

      if (!book)
        throw new CustomAPIError(`Book ID #${data.bookId} is not exist.`);

      if (book.stock_quantity < data.quantity) {
        throw new CustomAPIError(
          `Not enough stock for book ID: ${data.bookId}`,
        );
      }

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
          book: { connect: { bookid: data.bookId } },
          quantity: data.quantity,
        },
      });

      return {
        message: 'Item successfully updated.',
      };
    } catch (error) {
      console.error('Error occurred while updating the item. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw Error(
        'An error occurred while updating the item. Please check if the cart ID and book ID are correct, and ensure the quantity is valid',
      );
    }
  }

  async claim(userId: string, cartId: number) {
    try {
      await this.prisma.$transaction(async (pr) => {
        const oldCart = await pr.cart.findUnique({
          where: { userid: userId },
          select: {
            cart_items: true,
          },
        });

        if (oldCart && oldCart.cart_items.length > 0) {
          throw new CustomAPIError('User alredy has a cart.');
        }

        // remove user's empty cart
        if (oldCart) {
          await pr.cart.delete({ where: { userid: userId } });
        }

        // user can only claim the cart created by the guest
        await pr.cart.update({
          where: { id: cartId, AND: [{ userid: null }] },
          data: { user: { connect: { userid: userId } } },
        });
      });

      return { message: 'User is attached to the cart.' };
    } catch (error) {
      console.error('Failed to claim the cart. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new Error('User can only claim the cart created by the guest.');
    }
  }

  async removeInactiveGuestCarts() {
    try {
      // remove the inactive carts
      // the cart is inactive if it was created less than 1 day ago.
      const currentDateTime = new Date().getTime();
      const expirationDate = new Date(currentDateTime - 24 * 60 * 60 * 1000);

      const carts = await this.prisma.cart.deleteMany({
        where: { userid: null, created_at: { lt: expirationDate } },
      });

      return { carts };
    } catch (error) {
      console.error('Failed to remove inactive guest carts. Error:', error);
      throw new Error('Failed to remove inactive guest carts');
    }
  }
}
