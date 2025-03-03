import {
  IsBoolean,
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

export class CreateBookDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => {
    const data = sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    });

    return data.trim();
  })
  title: string;

  @IsInt()
  categoryId: number;

  @IsISBN()
  isbn: string;

  @IsPositive()
  price: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    const data = sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    });

    return data.trim();
  })
  description?: string;

  @IsInt()
  @Min(0)
  stockQuantity: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsBoolean()
  isActive: boolean;
}
