import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class CartItemDto {
  @ApiProperty()
  @IsInt()
  cartId: number;

  @ApiProperty()
  @IsInt()
  bookId: number;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  quantity: number;
}
