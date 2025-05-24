import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class AddToCartDTO {
  @ApiProperty({
    description: 'Book ID',
    example: 'a1b2c3d4-e5f6-7890-ab12-cd34ef56gh78',
  })
  @IsNotEmpty()
  @IsString()
  bookId: string;

  @ApiProperty({ description: 'Quantity of the book', example: 2 })
  @IsInt()
  @IsPositive()
  quantity: number;
}
