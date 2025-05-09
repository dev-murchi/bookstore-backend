import { HttpException, HttpStatus } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import * as sanitizeHtml from 'sanitize-html';

export class BookReviewDTO {
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

  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => {
    const data = sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    });

    return data.trim();
  })
  readonly data: string;
}
