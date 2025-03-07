import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartItemDto } from './dto/cart-item.dto';
import { DeleteCartItemDto } from './dto/delete-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}
  async createCart(userId: number) {
    const cart = await this.prisma.cart.upsert({
      where: { userid: userId },
      update: {},
      create: { user: { connect: { id: userId } } },
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

  async addItem(cartId: number, data: CartItemDto) {
    const item = await this.prisma.cart_items.create({
      data: {
        cart: { connect: { id: cartId } },
        book: { connect: { id: data.bookId } },
        quantity: data.quantity,
      },
    });

    return {
      cartId,
      bookId: item.bookid,
      quatity: item.quantity,
    };
  }

  async updateItem(cartId: number, data: CartItemDto) {
    const item = await this.prisma.cart_items.update({
      where: {
        cartid_bookid: {
          bookid: data.bookId,
          cartid: cartId,
        },
      },
      data: { quantity: data.quantity },
    });

    return {
      cartId: cartId,
      bookId: item.bookid,
      quantity: item.quantity,
    };
  }

  async removeItem(cartId: number, data: DeleteCartItemDto) {
    const item = await this.prisma.cart_items.delete({
      where: {
        cartid_bookid: {
          cartid: cartId,
          bookid: data.bookId,
        },
      },
    });

    return {
      cartId: cartId,
      bookId: item.bookid,
      quantity: 0,
    };
  }

  async removeItems(cartId: number, data: DeleteCartItemDto[]) {
    const items = data.map((item) => {
      return this.prisma.cart_items.delete({
        where: {
          cartid_bookid: {
            cartid: cartId,
            bookid: item.bookId,
          },
        },
      });
    });

    return (await this.prisma.$transaction(items)).map((i) => ({
      cartId: cartId,
      bookId: i.bookid,
      quantity: 0,
    }));
  }

  async upsertItem(cartId: number, data: CartItemDto) {
    const item = await this.prisma.cart_items.upsert({
      where: {
        cartid_bookid: {
          cartid: cartId,
          bookid: data.bookId,
        },
      },
      update: { quantity: data.quantity },
      create: {
        cart: { connect: { id: cartId } },
        book: { connect: { id: data.bookId } },
        quantity: data.quantity,
      },
    });

    return {
      cartId,
      bookId: item.bookid,
      quatity: item.quantity,
    };
  }

  async upsertItems(cartId: number, data: CartItemDto[]) {
    const items = data.map((item) => {
      return this.prisma.cart_items.upsert({
        where: {
          cartid_bookid: {
            cartid: cartId,
            bookid: item.bookId,
          },
        },
        update: { quantity: item.quantity },
        create: {
          cart: { connect: { id: cartId } },
          book: { connect: { id: item.bookId } },
          quantity: item.quantity,
        },
      });
    });

    return (await this.prisma.$transaction(items)).map((i) => ({
      cartId: cartId,
      bookId: i.bookid,
      quantity: i.quantity,
    }));
  }
}
