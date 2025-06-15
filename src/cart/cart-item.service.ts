import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToCartDTO } from '../common/dto/add-to-cart.dto';
import { CustomAPIError } from '../common/errors/custom-api.error';
import { CartItemDTO } from '../common/dto/cart-item.dto';
import { BookDTO } from '../common/dto/book.dto';
import { CategoryDTO } from '../common/dto/category.dto';
import { DeleteCartItemDTO } from '../common/dto/delete-cart-item.dto';
import { Prisma } from '@prisma/client';
import { validate } from 'class-validator';

const bookSelect = {
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

const cartItemSelect = {
  id: true,
  quantity: true,
  book: { select: bookSelect },
};

@Injectable()
export class CartItemService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrUpdateItem(
    cartId: string,
    data: AddToCartDTO,
  ): Promise<CartItemDTO> {
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
        update: { quantity: data.quantity, updated_at: new Date() },
        create: {
          cart: { connect: { id: cartId } },
          book: { connect: { id: data.bookId } },
          quantity: data.quantity,
        },
        select: cartItemSelect,
      });

      return await this.transformCartItemData(cartItem);
    } catch (error) {
      console.error('Error updating item. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new Error('Failed to update item. Check input data.');
    }
  }

  async deleteItem(
    cartId: string,
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

  async getItems(cartId: string) {
    const items = await this.prisma.cart_items.findMany({
      where: { cartid: cartId },
      orderBy: { bookid: Prisma.SortOrder.asc },
      select: cartItemSelect,
    });

    return await Promise.all(
      items.map((item) => this.transformCartItemData(item)),
    );
  }

  async deleteItems(cartId: string): Promise<{ count: number }> {
    const res = await this.prisma.cart_items.deleteMany({
      where: { cartid: cartId },
    });
    return { count: res.count };
  }

  private async transformCartItemData(data: any): Promise<CartItemDTO> {
    const item = new BookDTO(
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
    const cartItem = new CartItemDTO(data.quantity, item);

    const errors = await validate(cartItem);
    if (errors.length > 0) {
      console.error('Validation failed. Error:', errors);
      throw new Error('Validation failed.');
    }

    return cartItem;
  }
}
