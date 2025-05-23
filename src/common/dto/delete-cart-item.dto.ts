import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class DeleteCartItemDto {
  @ApiProperty({ description: 'Cart ID', example: 1 })
  @IsInt()
  cartId: number;

  @ApiProperty({ description: 'Book ID to remove', example: 'book-uuid-123' })
  @IsNotEmpty()
  @IsString()
  bookId: string;
}
