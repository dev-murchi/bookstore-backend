import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateBookDTO } from './create-book.dto';
import { IsEmail } from 'class-validator';

export class UpdateBookDTO extends PartialType(CreateBookDTO) {
  @ApiProperty({
    description: 'Email of the author',
    example: 'author@email.com',
    format: 'email',
  })
  @IsEmail()
  author: string;
}
