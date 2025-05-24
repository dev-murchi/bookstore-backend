import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class CreateCheckoutDTO {
  @ApiProperty({ description: 'Cart ID to checkout', example: 5 })
  @IsInt()
  cartId: number;
}
