import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import * as sanitizeHtml from 'sanitize-html';

export class CreateReviewDTO {
  @ApiProperty({
    description: 'ID of the book being reviewed',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-4890-ab12-cd34ef56ab78',
  })
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  readonly bookId: string;

  @ApiProperty({
    description: 'Rating between 0 and 5',
    minimum: 0,
    maximum: 5,
    example: 5,
  })
  @IsNotEmpty()
  @IsInt()
  @Transform(({ value }) => {
    if (value > 5 || value < 0)
      throw new HttpException(
        'Rating must be between [0 and 5].',
        HttpStatus.NOT_ACCEPTABLE,
      );

    return value;
  })
  readonly rating: number;

  @ApiProperty({
    description: 'Text content of the review',
    example: 'This book was incredibly insightful and well-written.',
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) =>
    sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim(),
  )
  readonly data: string;

  constructor(bookId: string, data: string, rating: number) {
    this.bookId = bookId;
    this.data = data;
    this.rating = rating;
  }
}
