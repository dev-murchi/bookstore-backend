import { IsInt } from 'class-validator';

export class DeleteCartItemDto {
  @IsInt()
  cartId: number;

  @IsInt()
  bookId: number;
}
