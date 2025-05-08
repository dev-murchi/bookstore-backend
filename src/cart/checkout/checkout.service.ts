import { Injectable } from '@nestjs/common';
import { CreateCheckoutDto } from '../dto/create-checkout.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentService } from '../../payment/payment.service';
import { CustomAPIError } from '../../common/errors/custom-api.error';
import { CheckoutData, OrderItem } from '../../common/types';
import Stripe from 'stripe';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}
  async checkout(
    userId: string | null,
    data: CreateCheckoutDto,
  ): Promise<CheckoutData> {
    try {
      return await this.prisma.$transaction(async (pr) => {
        const cart = await pr.cart.findUnique({
          where: { id: data.cartId },
          select: {
            cart_items: {
              select: {
                book: {
                  select: {
                    bookid: true,
                    title: true,
                    price: true,
                    stock_quantity: true,
                    description: true,
                    isbn: true,
                    rating: true,
                    image_url: true,
                    author: { select: { name: true } },
                    category: { select: { category_name: true } },
                  },
                },
                quantity: true,
              },
            },
            user: {
              select: {
                userid: true,
                email: true,
                name: true,
              },
            },
          },
        });

        if (!cart) {
          throw new CustomAPIError('Please check if the cart ID is correct.');
        }

        let totalPrice = 0;
        const orderItems = [];
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

        const orderItemsToCreate = [];
        const updateStockPromises = [];

        for (const cartItem of cart.cart_items) {
          if (cartItem.book.stock_quantity < cartItem.quantity) {
            throw new CustomAPIError(
              `Not enough stock for book ID: ${cartItem.book.bookid}`,
            );
          }

          totalPrice += Number(
            cartItem.book.price.toNumber() * cartItem.quantity,
          );

          orderItems.push(this.transformToOrderItem(cartItem));
          lineItems.push(this.transformToStripeLineItem(cartItem));

          updateStockPromises.push(
            pr.books.update({
              where: { bookid: cartItem.book.bookid },
              data: {
                stock_quantity: { decrement: cartItem.quantity },
              },
            }),
          );

          orderItemsToCreate.push({
            bookid: cartItem.book.bookid,
            quantity: cartItem.quantity,
          });
        }

        totalPrice = Number(totalPrice.toFixed(2));

        // Create the order
        const order = await pr.orders.create({
          data: {
            totalPrice,
            status: 'pending',
            userid: userId,
            order_items: {
              createMany: {
                data: orderItemsToCreate,
              },
            },
          },
        });

        // Update stock
        await Promise.all(updateStockPromises);

        // Delete the cart
        await pr.cart.delete({ where: { id: data.cartId } });

        // Create Stripe session
        let session;
        try {
          session = await this.paymentService.createStripeCheckoutSession({
            mode: 'payment',
            payment_method_types: ['card'],
            shipping_address_collection: {
              allowed_countries: ['TR', 'GB', 'US', 'JP'],
            },
            metadata: {
              orderId: order.id,
            },
            payment_intent_data: {
              metadata: {
                orderId: order.id,
              },
            },
            customer_email: cart.user ? cart.user.email : undefined,
            line_items: lineItems,
            success_url: 'http://localhost:8080/success',
            cancel_url: 'http://localhost:8080/cancel',
            expires_at: Math.floor(Date.now() / 1000) + 60 * 30,
          });
        } catch (stripeError) {
          console.error('Error creating Stripe session:', stripeError);
          throw new CustomAPIError(
            'Failed to create payment session. Please try again later.',
          );
        }

        return {
          order: {
            id: order.id,
            userId: order.userid,
            items: orderItems,
            status: order.status,
            price: Number(order.totalPrice.toFixed(2)),
          },
          message: 'Checkout successful.',
          expiresAt: session.expires,
          url: session.url,
        };
      });
    } catch (error) {
      console.error('Checkout failed. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new Error('Checkout failed. Please try again later.');
    }
  }

  private transformToOrderItem(cartItem: any): OrderItem {
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
        category: { value: cartItem.book.category.category_name },
      },
    };
  }

  private transformToStripeLineItem(
    cartItem: any,
  ): Stripe.Checkout.SessionCreateParams.LineItem {
    return {
      price_data: {
        product_data: {
          name: cartItem.book.title,
          images: [],
        },
        unit_amount: Number((cartItem.book.price.toNumber() * 100).toFixed(0)),
        currency: 'usd',
      },
      quantity: cartItem.quantity,
    };
  }
}
