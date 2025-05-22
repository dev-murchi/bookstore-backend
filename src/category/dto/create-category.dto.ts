import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCategoryDTO {
  @ApiProperty({
    description: 'Name of the new category',
    example: 'Science Fiction',
  })
  @IsNotEmpty()
  @IsString()
  value: string;
}
