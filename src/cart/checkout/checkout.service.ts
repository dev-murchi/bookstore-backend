import { Injectable } from '@nestjs/common';
import { CreateCheckoutDto } from '../../common/dto/create-checkout.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentService } from '../../payment/payment.service';
import { CustomAPIError } from '../../common/errors/custom-api.error';
import Stripe from 'stripe';
import { HelperService } from '../../common/helper.service';
import { CheckoutDTO } from '../../common/dto/checkout.dto';
import { OrderDTO } from '../../common/dto/order.dto';
import { OrderItemDTO } from '../../common/dto/order-item.dto';
import { BookDTO } from '../../common/dto/book.dto';
import { CategoryDTO } from '../../common/dto/category.dto';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}
  async checkout(
    userId: string | null,
    data: CreateCheckoutDto,
  ): Promise<CheckoutDTO> {
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
          },
        });

        if (!cart) {
          throw new CustomAPIError('Please check if the cart ID is correct.');
        }

        let totalPrice = 0;
        const orderItems: OrderItemDTO[] = [];
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
            orderid: HelperService.generateUUID(),
            totalPrice,
            status: 'pending',
            userid: userId,
            order_items: {
              createMany: {
                data: orderItemsToCreate,
              },
            },
          },
          select: {
            orderid: true,
            status: true,
            user: { select: { name: true, email: true } },
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
              orderId: order.orderid,
            },
            payment_intent_data: {
              metadata: {
                orderId: order.orderid,
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
        orderData.id = order.orderid;
        orderData.owner = userId;
        orderData.price = totalPrice;
        orderData.status = order.status;
        orderData.items = orderItems;

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
    const orderItem = new OrderItemDTO();
    orderItem.quantity = cartItem.quantity;
    orderItem.item = new BookDTO(
      cartItem.book.bookid,
      cartItem.book.title,
      cartItem.book.description,
      cartItem.book.isbn,
      { name: cartItem.book.author.name },
      new CategoryDTO(
        cartItem.book.category.id,
        cartItem.book.category.category_name,
      ),
      Number(cartItem.book.price.toFixed(2)),
      Number(cartItem.book.rating.toFixed(2)),
      cartItem.book.image_url,
    );

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
