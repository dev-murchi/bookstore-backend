import { IsInt, IsNotEmpty, IsNumber, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BookDTO } from './book.dto';

export class OrderItemDTO {
  @ApiProperty({
    description: 'Quantity of the book',
    example: 2,
  })
  @IsNotEmpty()
  @IsNumber()
  @IsInt()
  quantity: number;

  @ApiProperty({
    description: 'Details of the book being added to the order',
    type: () => BookDTO,
  })
  @ValidateNested()
  @Type(() => BookDTO)
  item: BookDTO;
}
