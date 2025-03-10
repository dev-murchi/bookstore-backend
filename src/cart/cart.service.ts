import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartItemDto } from './dto/cart-item.dto';
import { DeleteCartItemDto } from './dto/delete-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}
  async createCart(userId: number | null) {
    const cart = await this.prisma.cart.create({
      data: {
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

  async updateItem(data: CartItemDto) {
    const item = await this.prisma.cart_items.update({
      where: {
        cartid_bookid: {
          bookid: data.bookId,
          cartid: data.cartId,
        },
      },
      data: { quantity: data.quantity },
    });

    return {
      message: 'Item successfully updated.',
    };
  }

  async removeItem(data: DeleteCartItemDto) {
    // try {
    await this.prisma.cart_items.delete({
      where: {
        cartid_bookid: {
          cartid: data.cartId,
          bookid: data.bookId,
        },
      },
    });

    return {
      message: 'Item successfully deleted.',
    };
    // } catch (error) {
    //   throw new Error('Item could not deleted.');
    // }
  }

  async upsertItem(data: CartItemDto) {
    await this.prisma.cart_items.upsert({
      where: {
        cartid_bookid: {
          cartid: data.cartId,
          bookid: data.bookId,
        },
      },
      update: { quantity: data.quantity },
      create: {
        cart: { connect: { id: data.cartId } },
        book: { connect: { id: data.bookId } },
        quantity: data.quantity,
      },
    });

    return {
      message: 'Item successfully updated.',
    };
  }

  async attachUser(userId: number, cartId: number) {
    await this.prisma.cart.update({
      where: { id: cartId },
      data: { user: { connect: { id: userId } } },
    });
    return { message: 'User is attached to the cart.' };
  }
}
