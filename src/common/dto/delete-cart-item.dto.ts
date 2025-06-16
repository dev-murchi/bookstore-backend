import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DeleteCartItemDTO {
  @ApiProperty({
    description: 'Book ID to remove',
    example: 'ba1b2c3d4-e5f6-4890-ab12-cd34ef56ab78',
  })
  @IsNotEmpty()
  @IsString()
  bookId: string;
}
