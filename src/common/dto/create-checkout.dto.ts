import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty({ description: 'Cart ID to checkout', example: 5 })
  @IsInt()
  cartId: number;
}
