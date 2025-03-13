import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class DeleteCartItemDto {
  @ApiProperty()
  @IsInt()
  cartId: number;

  @ApiProperty()
  @IsInt()
  bookId: number;
}
