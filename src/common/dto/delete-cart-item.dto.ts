import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class DeleteCartItemDto {
  @ApiProperty({ description: 'Book ID to remove', example: 'book-uuid-123' })
  @IsNotEmpty()
  @IsString()
  bookId: string;
}
