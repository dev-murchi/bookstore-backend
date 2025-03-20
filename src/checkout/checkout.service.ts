import { Injectable } from '@nestjs/common';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}
  async checkout(userId: number | null, data: CreateCheckoutDto) {
    try {
      return await this.prisma.$transaction(async (pr) => {
        const cart = await pr.cart.findUnique({
          where: { id: data.cartId, AND: [{ userid: userId }] },
          select: {
            cart_items: {
              select: {
                book: {
                  select: {
                    id: true,
                    price: true,
                    stock_quantity: true,
                  },
                },
                quantity: true,
              },
            },
          },
        });

        if (!cart) throw new Error('Cart is not exist');

        const cartItems = cart.cart_items;

        if (cartItems.length === 0) {
          throw new Error('Cart is empty.');
        }

        // check stock availability for each cart item
        let totalPrice = 0;
        for (const item of cartItems) {
          if (item.book.stock_quantity < item.quantity) {
            throw new Error(`Not enough stock for book ID: ${item.book.id}`);
          }
          // Calculate the total price for each item and accumulate it
          totalPrice += parseFloat(totalPrice.toFixed(2)) * item.quantity;
        }

        totalPrice = parseFloat(totalPrice.toFixed(2));

        // create the order and order items in a single transaction
        const order = await pr.orders.create({
          data: {
            totalPrice,
            status: 'pending',
            userid: userId,
            order_items: {
              createMany: {
                data: cartItems.map((item) => ({
                  bookid: item.book.id,
                  quantity: item.quantity,
                })),
              },
            },
          },
          select: {
            id: true,
            totalPrice: true,
            status: true,
            order_items: {
              select: {
                book: {
                  select: {
                    id: true,
                    title: true,
                    price: true,
                  },
                },
                quantity: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        // update book stock quantities
        await Promise.all(
          order.order_items.map((item) => {
            return pr.books.update({
              where: { id: item.book.id },
              data: { stock_quantity: { decrement: item.quantity } },
            });
          }),
        );

        // remove the cart session
        await pr.cart.delete({ where: { id: data.cartId } });

        // return relevant data
        return {
          order: {
            id: order.id,
            user: order.user,
            items: order.order_items.map((item) => ({
              quantity: 2,
              bookId: item.book.id,
              price: parseFloat(item.book.price.toFixed(2)),
              bookTitle: item.book.title,
            })),
            status: order.status,
            totalPrice: parseFloat(order.totalPrice.toFixed(2)),
          },
          message: 'Checkout successfull.',
        };
      });
    } catch (error) {
      if (error.message === 'Cart is not exist') {
        throw new Error('Please check if the cart ID is correct.');
      }

      if (error.message === 'Cart is empty.') {
        throw new Error('Your cart is empty. Please add items to your cart.');
      }

      if (error.message.startsWith('Not enough stock')) {
        throw new Error(error.message);
      }

      throw new Error('Checkout failed. Please try again later.');
    }
  }
}
