import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class AddToCartDTO {
  @ApiProperty({ description: 'Book ID', example: 'book-uuid-123' })
  @IsNotEmpty()
  @IsString()
  bookId: string;

  @ApiProperty({ description: 'Quantity of the book', example: 2 })
  @IsInt()
  @IsPositive()
  quantity: number;
}
