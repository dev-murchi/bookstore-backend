import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class DeleteCartItemDto {
  @ApiProperty({
    description: 'Book ID to remove',
    example: 'ba1b2c3d4-e5f6-7890-ab12-cd34ef56gh78',
  })
  @IsNotEmpty()
  @IsString()
  bookId: string;
}
