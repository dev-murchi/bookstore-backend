import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderDTO } from 'src/common/dto/order.dto';
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
  })
  @ValidateNested()
  @Type(() => OrderDTO)
  order: OrderDTO;
}
