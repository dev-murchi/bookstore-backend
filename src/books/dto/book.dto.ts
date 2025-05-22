import {
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CategoryDTO } from '../../category/dto/category.dto';
import { Type } from 'class-transformer';

export class BookDTO {
  @ApiProperty({
    description: 'Unique identifier for the book',
    example: 'a1b2c3d4-e5f6-7890-ab12-cd34ef56gh78',
  })
  @IsNotEmpty()
  @IsString()
  readonly id: string;

  @ApiProperty({
    description: 'Title of the book',
    example: "Wanderlust: A Traveler's Guide to the World",
  })
  @IsNotEmpty()
  @IsString()
  readonly title: string;

  @ApiProperty({
    description: 'Short description or summary of the book',
    example: "Explore the world's most breathtaking destinations.",
  })
  @IsNotEmpty()
  @IsString()
  readonly description: string;

  @ApiProperty({
    description: 'International Standard Book Number',
    example: '978-0451526342',
  })
  @IsNotEmpty()
  @IsString()
  readonly isbn: string;

  @ApiProperty({
    description: 'Author information',
    example: { name: 'Traveler Hobbits' },
  })
  @IsNotEmptyObject()
  readonly author: { name: string };

  @ApiProperty({
    description: 'Category object representing the book category',
    type: () => CategoryDTO,
    example: {
      id: 3,
      value: 'Travel',
    },
  })
  @ValidateNested()
  @Type(() => CategoryDTO)
  readonly category: CategoryDTO;

  @ApiProperty({
    description: 'Price of the book in USD',
    example: 19.99,
  })
  @IsNumber()
  readonly price: number;

  @ApiProperty({
    description: 'Average rating of the book (0-5)',
    example: 4.5,
  })
  @IsNumber()
  readonly rating: number;

  @ApiProperty({
    description: 'Publicly accessible URL of the book cover image',
    example: 'https://example.com/images/wanderlust-book-cover.jpg',
  })
  @IsNotEmpty()
  @IsString()
  readonly imageUrl: string;

  constructor(
    id: string,
    title: string,
    description: string,
    isbn: string,
    author: { name: string },
    category: CategoryDTO,
    price: number,
    rating: number,
    imageUrl: string,
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.isbn = isbn;
    this.author = { name: author.name };
    this.category = category;
    this.price = price;
    this.rating = rating;
    this.imageUrl = imageUrl;
  }
}
