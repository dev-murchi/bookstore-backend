import { IsInt, IsPositive } from 'class-validator';

export class CartItemDto {
  @IsInt()
  bookId: number;

  @IsInt()
  @IsPositive()
  quantity: number;
}
