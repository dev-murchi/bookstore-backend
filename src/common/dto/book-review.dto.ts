import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import * as sanitizeHtml from 'sanitize-html';

export class BookReviewDTO {
  @ApiProperty({
    description: 'Rating from 0 to 5',
    minimum: 0,
    maximum: 5,
    example: 4,
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
    description: 'Review comment or message',
    example: 'Loved the book!',
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) =>
    sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim(),
  )
  readonly data: string;
}
