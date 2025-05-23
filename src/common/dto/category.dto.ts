import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CategoryDTO {
  @ApiProperty({
    description: 'Unique identifier for the category',
    example: 1,
  })
  @IsNumber()
  readonly id: number;

  @ApiProperty({
    description: 'Name or label of the category',
    example: 'Science Fiction',
  })
  @IsString()
  @IsNotEmpty()
  readonly value: string;

  constructor(id: number, value: string) {
    this.id = id;
    this.value = value;
  }
}
