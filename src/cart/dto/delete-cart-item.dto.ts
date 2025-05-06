import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class DeleteCartItemDto {
  @ApiProperty()
  @IsInt()
  cartId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  bookId: string;
}
