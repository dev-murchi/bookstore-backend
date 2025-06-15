import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CartCheckoutAction } from '../enum/cart-checkout-action.enum';

export class CheckoutRequestDTO {
  @ApiProperty({
    description: 'The unique identifier of the guest cart to be synchronized.',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    format: 'uuid',
  })
  @IsUUID()
  readonly guestCartId: string;

  @ApiProperty({
    description:
      'The session token associated with the guest cart, used for validation.',
    example: 'your_secure_guest_cart_token_here',
    minLength: 1,
  })
  @IsNotEmpty()
  @IsString()
  readonly guestCartToken: string;

  @ApiProperty({
    description: 'The desired action for synchronizing the carts.',
    enum: CartCheckoutAction,
    example: CartCheckoutAction.MERGE,
  })
  @IsEnum(CartCheckoutAction)
  readonly action: CartCheckoutAction;
}
