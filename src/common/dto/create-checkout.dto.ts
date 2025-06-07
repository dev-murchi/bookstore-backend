import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateCheckoutDTO {
  @ApiProperty({ description: 'Cart ID to checkout', example: 'uuid' })
  @IsUUID()
  cartId: string;
}
