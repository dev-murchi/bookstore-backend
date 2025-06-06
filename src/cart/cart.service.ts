import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartItemDTO } from '../common/dto/cart-item.dto';
import { DeleteCartItemDTO } from '../common/dto/delete-cart-item.dto';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { Prisma } from '@prisma/client';
import { AddToCartDTO } from '../common/dto/add-to-cart.dto';
import { CartDTO } from '../common/dto/cart.dto';
import { BookDTO } from '../common/dto/book.dto';
import { CategoryDTO } from '../common/dto/category.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  // selection objects
  private readonly bookSelect = {
    id: true,
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

  async createCart(userId: string | null): Promise<CartDTO> {
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

  async findCartById(cartId: number): Promise<CartDTO | null> {
    return await this.findCartAndTransformData({ id: cartId });
  }

  async findCartByUser(userId: string): Promise<CartDTO | null> {
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

  async removeItem(
    cartId: number,
    data: DeleteCartItemDTO,
  ): Promise<{ message: string }> {
    try {
      await this.prisma.cart_items.delete({
        where: {
          cartid_bookid: {
            cartid: cartId,
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

  async upsertItem(cartId: number, data: AddToCartDTO): Promise<CartItemDTO> {
    try {
      const book = await this.prisma.books.findUnique({
        where: { id: data.bookId },
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

  async claim(userId: string, cartId: number): Promise<CartDTO> {
    try {
      const cart = await this.prisma.$transaction(async () => {
        const usersCart = await this.findCartBy({ userid: userId });

        if (usersCart && usersCart.cart_items.length) {
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
          { user: { connect: { id: userId } } },
        );

        return this.transformCartData(updatedCart);
      });

      return cart;
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
      create: { user: { connect: { id: userId } } },
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

  private transformCartItemData(data: any): CartItemDTO {
    const cartItem = new CartItemDTO();
    cartItem.quantity = data.quantity;
    cartItem.item = new BookDTO(
      data.book.id,
      data.book.title,
      data.book.description,
      data.book.isbn,
      { name: data.book.author.name },
      new CategoryDTO(data.book.category.id, data.book.category.category_name),
      Number(data.book.price.toFixed(2)),
      Number(data.book.rating.toFixed(2)),
      data.book.image_url,
    );

    return cartItem;
  }

  private transformCartData(cartData: any): CartDTO {
    const cartItems = cartData.cart_items.map((cartItem) => {
      return this.transformCartItemData(cartItem);
    });
    const totalPrice = Number(
      cartItems
        .reduce((sum, item) => sum + item.item.price * item.quantity, 0)
        .toFixed(2),
    );

    return new CartDTO(cartData.id, cartData.userid, totalPrice, cartItems);
  }
}
