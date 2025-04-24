import { PartialType } from '@nestjs/swagger';
import { CreateBookDto } from './create-book.dto';
import { IsEmail } from 'class-validator';

export class UpdateBookDto extends PartialType(CreateBookDto) {
  @IsEmail()
  author: string;
}
