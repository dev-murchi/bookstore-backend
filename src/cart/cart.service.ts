import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartItemDto } from './dto/cart-item.dto';
import { DeleteCartItemDto } from './dto/delete-cart-item.dto';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { Cart, CartItem } from '../common/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  // selection objects
  private readonly bookSelect = {
    bookid: true,
    title: true,
    description: true,
    isbn: true,
    price: true,
    rating: true,
    image_url: true,
    author: { select: { name: true } },
    category: { select: { id: true, category_name: true } },
  };

  private readonly cartSelect = {
    id: true,
    userid: true,
    cart_items: {
      orderBy: { bookid: Prisma.SortOrder.asc },
      select: {
        quantity: true,
        book: { select: this.bookSelect },
      },
    },
  };

  async createCart(userId: string | null): Promise<Cart> {
    try {
      const cart = userId
        ? await this.cartUpsert(userId)
        : await this.cartCreate(userId);
      return this.transformCartData(cart);
    } catch (error) {
      console.error('Error creating cart. Error:', error);
      throw new Error('Cart creation failed.');
    }
  }

  async findCartById(cartId: number): Promise<Cart | null> {
    return await this.findCartAndTransformData({ id: cartId });
  }

  async findCartByUser(userId: string): Promise<Cart | null> {
    return await this.findCartAndTransformData({ userid: userId });
  }

  private async findCartAndTransformData(
    condition: Prisma.cartWhereUniqueInput,
  ) {
    try {
      const cart = await this.findCartBy(condition);
      return cart ? this.transformCartData(cart) : null;
    } catch (error) {
      console.error('Failed to fetch the cart. Error:', error);
      throw new Error('Failed to fetch the cart.');
    }
  }

  async removeItem(data: DeleteCartItemDto): Promise<{ message: string }> {
    try {
      await this.prisma.cart_items.delete({
        where: {
          cartid_bookid: {
            cartid: data.cartId,
            bookid: data.bookId,
          },
        },
      });

      return { message: 'Item successfully deleted.' };
    } catch (error) {
      console.error('Error deleting item. Error:', error);
      throw new Error('Failed to delete item. Check cart and book IDs.');
    }
  }

  async upsertItem(data: CartItemDto): Promise<CartItem> {
    try {
      const book = await this.prisma.books.findUnique({
        where: { bookid: data.bookId },
        select: { stock_quantity: true },
      });

      if (!book) {
        throw new CustomAPIError(`Book ID #${data.bookId} does not exist.`);
      }

      if (book.stock_quantity < data.quantity) {
        throw new CustomAPIError(
          `Insufficient stock for book ID: ${data.bookId}`,
        );
      }

      const cartItem = await this.prisma.cart_items.upsert({
        where: {
          cartid_bookid: {
            cartid: data.cartId,
            bookid: data.bookId,
          },
        },
        update: { quantity: data.quantity },
        create: {
          cart: { connect: { id: data.cartId } },
          book: { connect: { bookid: data.bookId } },
          quantity: data.quantity,
        },
        select: {
          quantity: true,
          book: { select: this.bookSelect },
        },
      });

      return this.transformCartItemData(cartItem);
    } catch (error) {
      console.error('Error updating item. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new Error('Failed to update item. Check input data.');
    }
  }

  async claim(userId: string, cartId: number): Promise<Cart> {
    try {
      const cart = await this.prisma.$transaction(async () => {
        const usersCart = await this.findCartBy({ userid: userId });

        if (usersCart.cart_items.length) {
          throw new CustomAPIError('User already has a cart.');
        }

        const guestCart = await this.findCartBy({ id: cartId });
        if (!guestCart) throw new CustomAPIError('Cart does not exist.');
        if (guestCart.userid)
          throw new CustomAPIError('Cart is not a guest cart.');

        if (usersCart) {
          await this.prisma.cart.delete({ where: { userid: userId } });
        }

        const updatedCart = await this.cartUpdate(
          { id: cartId },
          { user: { connect: { userid: userId } } },
        );

        return this.transformCartData(updatedCart);
      });

      return cart as Cart;
    } catch (error) {
      console.error('Failed to claim cart. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new Error('Only guest carts can be claimed.');
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

  private async cartCreate(userId: string | null) {
    return this.prisma.cart.create({
      data: { userid: userId },
      select: this.cartSelect,
    });
  }

  private async cartUpsert(userId: string) {
    return this.prisma.cart.upsert({
      where: { userid: userId },
      update: {},
      create: { user: { connect: { userid: userId } } },
      select: this.cartSelect,
    });
  }

  private async cartUpdate(
    condition: Prisma.cartWhereUniqueInput,
    data: Prisma.cartUpdateInput,
  ) {
    return this.prisma.cart.update({
      where: condition,
      data,
      select: this.cartSelect,
    });
  }

  private async findCartBy(condition: Prisma.cartWhereUniqueInput) {
    const data = await this.prisma.cart.findUnique({
      where: condition,
      select: this.cartSelect,
    });

    return data;
  }

  private transformCartItemData(cartItem: any): CartItem {
    return {
      quantity: cartItem.quantity,
      item: {
        id: cartItem.book.bookid,
        title: cartItem.book.title,
        description: cartItem.book.description,
        isbn: cartItem.book.isbn,
        price: Number(cartItem.book.price.toFixed(2)),
        rating: Number(cartItem.book.rating.toFixed(2)),
        imageUrl: cartItem.book.image_url,
        author: { name: cartItem.book.author.name },
        category: {
          id: cartItem.book.category.id,
          value: cartItem.book.category.category_name,
        },
      },
    };
  }

  private transformCartData(cartData: any): Cart {
    const cartItems = cartData.cart_items.map(this.transformCartItemData);
    const totalPrice = Number(
      cartItems
        .reduce((sum, item) => sum + item.item.price * item.quantity, 0)
        .toFixed(2),
    );

    return {
      id: cartData.id,
      owner: cartData.userid,
      items: cartItems,
      totalPrice,
    };
  }
}
