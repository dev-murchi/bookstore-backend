import { Injectable } from '@nestjs/common';
import { CreateCheckoutDTO } from '../../common/dto/create-checkout.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentService } from '../../payment/payment.service';
import { CustomAPIError } from '../../common/errors/custom-api.error';
import Stripe from 'stripe';
import { CheckoutDTO } from '../../common/dto/checkout.dto';
import { OrderDTO } from '../../common/dto/order.dto';
import { OrderItemDTO } from '../../common/dto/order-item.dto';
import { BookDTO } from '../../common/dto/book.dto';
import { CategoryDTO } from '../../common/dto/category.dto';
import { OrderStatus } from '../../common/enum/order-status.enum';
import { OrderOwnerDTO } from '../../common/dto/order-owner.dto';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}
  async checkout(
    userId: string | null,
    data: CreateCheckoutDTO,
  ): Promise<CheckoutDTO> {
    try {
      return await this.prisma.$transaction(async (pr) => {
        const cart = await pr.cart.findUnique({
          where: { id: data.cartId },
          select: {
            cartItems: {
              select: {
                book: {
                  select: {
                    id: true,
                    title: true,
                    price: true,
                    stockQuantity: true,
                    description: true,
                    isbn: true,
                    rating: true,
                    imageUrl: true,
                    author: { select: { name: true } },
                    category: { select: { name: true } },
                  },
                },
                quantity: true,
              },
            },
          },
        });

        if (!cart) {
          throw new CustomAPIError('Please check if the cart ID is correct.');
        }

        if (cart.cartItems.length < 1) {
          throw new CustomAPIError(
            'Please add items to your cart to perform checkout.',
          );
        }

        let totalPrice = 0;
        const orderItems: OrderItemDTO[] = [];
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

        const orderItemsToCreate = [];
        const updateStockPromises = [];

        for (const cartItem of cart.cartItems) {
          if (cartItem.book.stockQuantity < cartItem.quantity) {
            throw new CustomAPIError(
              `Not enough stock for book ID: ${cartItem.book.id}`,
            );
          }

          totalPrice += Number(
            cartItem.book.price.toNumber() * cartItem.quantity,
          );

          orderItems.push(this.transformToOrderItem(cartItem));
          lineItems.push(this.transformToStripeLineItem(cartItem));

          updateStockPromises.push(
            pr.book.update({
              where: { id: cartItem.book.id },
              data: {
                stockQuantity: { decrement: cartItem.quantity },
              },
            }),
          );

          orderItemsToCreate.push({
            bookId: cartItem.book.id,
            quantity: cartItem.quantity,
          });
        }

        totalPrice = Number(totalPrice.toFixed(2));

        // Create the order
        const order = await pr.order.create({
          data: {
            totalPrice,
            status: 'pending',
            userId: userId,
            orderItems: {
              createMany: {
                data: orderItemsToCreate,
              },
            },
          },
          select: {
            id: true,
            status: true,
            user: { select: { id: true, name: true, email: true } },
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
            customer_email: order.user ? order.user.email : undefined,
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

        const orderData = new OrderDTO();
        orderData.id = order.id;
        orderData.price = totalPrice;
        orderData.status = order.status as OrderStatus;
        orderData.items = orderItems;
        if (order.user) {
          orderData.owner = new OrderOwnerDTO(
            order.user.id,
            order.user.name,
            order.user.email,
          );
        } else {
          orderData.owner = null;
        }

        const checkoutData = new CheckoutDTO();
        checkoutData.expiresAt = session.expires;
        checkoutData.message = 'Checkout successful.';
        checkoutData.url = session.url;
        checkoutData.order = orderData;

        return checkoutData;
      });
    } catch (error) {
      console.error('Checkout failed. Error:', error);
      if (error instanceof CustomAPIError) throw error;
      throw new Error('Checkout failed. Please try again later.');
    }
  }

  private transformToOrderItem(cartItem: any): OrderItemDTO {
    const item = new BookDTO(
      cartItem.book.id,
      cartItem.book.title,
      cartItem.book.description,
      cartItem.book.isbn,
      { name: cartItem.book.author.name },
      new CategoryDTO(cartItem.book.category.id, cartItem.book.category.name),
      Number(cartItem.book.price.toFixed(2)),
      Number(cartItem.book.rating.toFixed(2)),
      cartItem.book.imageUrl,
    );

    const orderItem = new OrderItemDTO(item, cartItem.quantity);

    return orderItem;
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
