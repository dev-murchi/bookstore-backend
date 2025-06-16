import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISBN,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

import { Transform } from 'class-transformer';
import * as sanitizeHtml from 'sanitize-html';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookDTO {
  @ApiProperty({
    description: 'Book title',
    example: "There and Snack Again: A Hungry Hobbit's Guide to Middle-earth",
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) =>
    sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim(),
  )
  title: string;

  @ApiProperty({
    description: 'Category ID to which the book belongs',
    example: 3,
  })
  @IsInt()
  categoryId: number;

  @ApiProperty({
    description: 'ISBN of the book',
    example: '978-1-60123-456-2',
    format: 'isbn',
  })
  @IsISBN()
  isbn: string;

  @ApiProperty({ description: 'Price of the book', example: 29.99 })
  @IsPositive()
  price: number;

  @ApiProperty({
    description: 'Brief description of the book',
    required: false,
    example: 'This book covers...',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim(),
  )
  description?: string;

  @ApiProperty({ description: 'Stock quantity', example: 100, minimum: 0 })
  @IsInt()
  @Min(0)
  stockQuantity: number;

  @ApiProperty({
    description: 'URL of the book cover image',
    required: false,
    example: 'https://example.com/book.jpg',
  })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({
    description: 'Is the book currently active/available?',
    example: true,
  })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: "Author's email",
    example: 'bilbo@bookstore.com',
    format: 'email',
  })
  @IsEmail()
  author: string;
}
