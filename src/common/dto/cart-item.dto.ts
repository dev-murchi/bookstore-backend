import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class CartItemDto {
  @ApiProperty()
  @IsInt()
  cartId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  bookId: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  quantity: number;
}
