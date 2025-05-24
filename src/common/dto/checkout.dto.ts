import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderDTO } from '../../common/dto/order.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutDTO {
  @ApiProperty({
    description:
      'Stripe Checkout session URL where the user completes the payment',
    example: 'https://checkout.stripe.com/pay/cs_test_a1b2c3d4e5f6g7h8i9j0',
  })
  @IsUrl()
  url: string;

  @ApiProperty({
    description: 'Expiration timestamp (in seconds)',
    example: 1716864000,
  })
  @IsNotEmpty()
  @IsNumber()
  expiresAt: number;

  @ApiProperty({
    description: 'Informational message related to the checkout session',
    example: 'Checkout session created successfully.',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Order summary associated with the checkout',
    type: () => OrderDTO,
    example: {
      id: 'a1b2c3d4-e5f6-7890-abcd-123456789abc',
      owner: 'abcdef01-2345-6789-abcd-ef0123456789',
      items: [
        {
          quantity: 2,
          item: {
            id: 'a1b2c3d4-e5f6-7890-ab12-cd34ef56gh78',
            title: "Wanderlust: A Traveler's Guide to the World",
            description: "Explore the world's most breathtaking destinations.",
            isbn: '978-0451526342',
            author: {
              name: 'Traveler Hobbits',
            },
            category: {
              id: 3,
              value: 'Travel',
            },
            price: 19.99,
            rating: 4.5,
            imageUrl: 'https://example.com/images/wanderlust-book-cover.jpg',
          },
        },
      ],
      status: 'pending',
      price: 129.99,
    },
  })
  @ValidateNested()
  @Type(() => OrderDTO)
  order: OrderDTO;
}
