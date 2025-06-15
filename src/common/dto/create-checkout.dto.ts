import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateCheckoutDTO {
  @ApiProperty({
    description: 'Cart ID to checkout',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    format: 'uuid',
  })
  @IsUUID()
  cartId: string;
}
