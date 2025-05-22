import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateBookDto } from './create-book.dto';
import { IsEmail } from 'class-validator';

export class UpdateBookDto extends PartialType(CreateBookDto) {
  @ApiProperty({
    description: 'Email of the author',
    example: 'author@email.com',
    format: 'email',
  })
  @IsEmail()
  author: string;
}
