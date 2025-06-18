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
  imageUrl: true,
  author: { select: { name: true } },
  category: { select: { id: true, name: true } },
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
      const book = await this.prisma.book.findUnique({
        where: { id: data.bookId },
        select: { stockQuantity: true },
      });

      if (!book) {
        throw new CustomAPIError(`Book ID #${data.bookId} does not exist.`);
      }

      if (book.stockQuantity < data.quantity) {
        throw new CustomAPIError(
          `Insufficient stock for book ID: ${data.bookId}`,
        );
      }

      const cartItem = await this.prisma.cartItem.upsert({
        where: {
          cartId_bookId: {
            cartId: cartId,
            bookId: data.bookId,
          },
        },
        update: { quantity: data.quantity, updatedAt: new Date() },
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
      await this.prisma.cartItem.delete({
        where: {
          cartId_bookId: {
            cartId: cartId,
            bookId: data.bookId,
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
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cartId },
      orderBy: { bookId: Prisma.SortOrder.asc },
      select: cartItemSelect,
    });

    return await Promise.all(
      items.map((item) => this.transformCartItemData(item)),
    );
  }

  async deleteItems(cartId: string): Promise<{ count: number }> {
    const res = await this.prisma.cartItem.deleteMany({
      where: { cartId: cartId },
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
      new CategoryDTO(data.book.category.id, data.book.category.name),
      Number(data.book.price.toFixed(2)),
      Number(data.book.rating.toFixed(2)),
      data.book.imageUrl,
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
